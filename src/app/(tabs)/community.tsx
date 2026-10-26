import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth, useCategory } from '@/store/AuthContext';
import { fetchUserProfile } from '@/services/authService';
import {
  createComment,
  createCommunityPost,
  CommunityServiceError,
  deleteComment,
  deleteCommunityPost,
  getCommunityImageUrl,
  loadMorePosts,
  POST_CATEGORIES,
  reportPost,
  safeFirstName,
  subscribeToComments,
  subscribeToPostLike,
  subscribeToPosts,
  togglePostLike,
  type CommunityComment,
  type CommunityPost,
  type PostCategory,
  type ReportReason,
} from '@/services/communityService';

type FeedFilter = 'All' | PostCategory | 'My condition';
const FILTERS: FeedFilter[] = ['All', ...POST_CATEGORIES, 'My condition'];
const REPORT_REASONS: ReportReason[] = ['Spam', 'Harassment', 'Unsafe medical advice', 'Other'];

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunityServiceError) return error.message;
  const code = (error as { code?: string })?.code;
  if (code === 'unavailable' || code === 'network-request-failed') {
    return 'You appear to be offline. Please reconnect and try again.';
  }
  if (code === 'permission-denied') {
    return 'Firestore is rejecting Community access. Deploy the latest firestore.rules to the Firebase project used by this app, then retry.';
  }
  if (code === 'failed-precondition') {
    return 'Firestore needs a composite index for this feed. Open the Firebase error details and use its one-click index creation link.';
  }
  return fallback;
}

function timeLabel(date: Date | null): string {
  if (!date) return 'Just now';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CommunityScreen() {
  const colors = useTheme();
  const actionColor = colors.primary;
  const actionTextColor = '#FFFFFF';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { category: condition } = useCategory();
  const [filter, setFilter] = useState<FeedFilter>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postPage, setPostPage] = useState<{ key: string; posts: CommunityPost[] }>({ key: '', posts: [] });
  const [snapshotPage, setSnapshotPage] = useState<{
    key: string;
    snapshots: QueryDocumentSnapshot<DocumentData>[];
  }>({ key: '', snapshots: [] });
  const [loadedFilterKey, setLoadedFilterKey] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<{ key: string; message: string } | null>(null);
  const [feedOffline, setFeedOffline] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [postImage, setPostImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PostCategory>('Tips');
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [authorName, setAuthorName] = useState('Community member');
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('Spam');
  const [reporting, setReporting] = useState(false);

  const selectedPostCategory = POST_CATEGORIES.includes(filter as PostCategory)
    ? (filter as PostCategory)
    : null;
  const selectedCondition = filter === 'My condition' ? condition : null;
  const conditionUnavailable = filter === 'My condition' && !condition;
  const feedKey = `${filter}:${condition ?? ''}:${sortOrder}`;
  const posts = useMemo(
    () => postPage.key === feedKey ? postPage.posts : [],
    [feedKey, postPage],
  );
  const snapshots = useMemo(
    () => snapshotPage.key === feedKey ? snapshotPage.snapshots : [],
    [feedKey, snapshotPage],
  );
  const currentError = feedError?.key === feedKey ? feedError.message : '';
  const rulesDenied = currentError.includes('Deploy the latest firestore.rules');
  const loadingFeed = !conditionUnavailable && loadedFilterKey !== feedKey;
  const canLoadMore = hasMore && snapshotPage.key === feedKey && snapshots.length > 0;

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      void fetchUserProfile(user).then((profile) => {
        if (!active) return;
        const username = profile?.username;
        setAuthorName(
          typeof username === 'string' && username.trim()
            ? safeFirstName(username)
            : 'Community member',
        );
      }).catch((error: unknown) => {
        console.error('[Community] Could not load account name:', error);
      });
      return () => {
        active = false;
      };
    }, [user])
  );

  useEffect(() => {
    if (conditionUnavailable) {
      return;
    }

    const unsubscribe = subscribeToPosts(
      selectedPostCategory,
      selectedCondition,
      sortOrder,
      (newPosts, newSnapshots, isFromCache) => {
        setLoadedFilterKey(feedKey);
        setHasMore(newSnapshots.length === 30);
        setFeedOffline(isFromCache);
        setSnapshotPage((current) => {
          const older = current.key === feedKey
            ? current.snapshots.filter((snapshot) => !newSnapshots.some((item) => item.id === snapshot.id))
            : [];
          return { key: feedKey, snapshots: [...newSnapshots, ...older] };
        });
        setPostPage((current) => {
          const older = current.key === feedKey
            ? current.posts.filter((post) => !newPosts.some((item) => item.id === post.id))
            : [];
          return { key: feedKey, posts: [...newPosts, ...older] };
        });
        setFeedError(null);
      },
      (error) => {
        setLoadedFilterKey(feedKey);
        setFeedOffline(true);
        setFeedError({
          key: feedKey,
          message: errorMessage(error, 'We couldn’t load the community feed. Please try again.'),
        });
      },
    );
    return () => unsubscribe();
  }, [conditionUnavailable, feedKey, selectedCondition, selectedPostCategory, sortOrder]);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return posts
      .filter((post) => !post.hidden)
      .filter((post) => !normalizedQuery || [
        post.text,
        post.authorName,
        post.category,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
      .sort((a, b) => {
        const timeA = a.createdAt?.getTime() ?? 0;
        const timeB = b.createdAt?.getTime() ?? 0;
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [posts, searchQuery, sortOrder]);

  const pickPostImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo library access to attach an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const { uri, width, height } = result.assets[0];
        setPostImage({ uri, width, height });
      }
    } catch (error) {
      console.error('[Community] Could not select post image:', error);
      Alert.alert('Couldn’t select image', 'Please try again.');
    }
  };

  const handleLoadMore = async () => {
    const cursor = snapshots[snapshots.length - 1];
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const page = await loadMorePosts(selectedPostCategory, selectedCondition, sortOrder, cursor);
      setHasMore(page.snapshots.length === 30);
      setSnapshotPage((current) => {
        const knownSnapshots = current.key === feedKey ? current.snapshots : [];
        const known = new Set(knownSnapshots.map((snapshot) => snapshot.id));
        return {
          key: feedKey,
          snapshots: [...knownSnapshots, ...page.snapshots.filter((snapshot) => !known.has(snapshot.id))],
        };
      });
      setPostPage((current) => {
        const knownPosts = current.key === feedKey ? current.posts : [];
        const known = new Set(knownPosts.map((post) => post.id));
        return {
          key: feedKey,
          posts: [...knownPosts, ...page.posts.filter((post) => !known.has(post.id))],
        };
      });
    } catch (error) {
      setFeedError({
        key: feedKey,
        message: errorMessage(error, 'We couldn’t load more posts. Please try again.'),
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const submitPost = async () => {
    if (feedOffline) {
      Alert.alert('You’re offline', 'Reconnect to publish your post.');
      return;
    }
    if (!text.trim() && !postImage) {
      Alert.alert('Add to your post', 'Write a message or attach a photo before posting.');
      return;
    }
    setPosting(true);
    try {
      await createCommunityPost({
        text,
        image: postImage,
        authorName,
        isAnonymous: anonymous,
        category: selectedCategory,
        conditionCategory: condition,
      });
      setText('');
      setPostImage(null);
      setAnonymous(false);
      setComposerOpen(false);
    } catch (error) {
      Alert.alert('Couldn’t post', errorMessage(error, 'Please try again.'));
    } finally {
      setPosting(false);
    }
  };

  const confirmDeletePost = (post: CommunityPost) => {
    Alert.alert('Delete this post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteCommunityPost(post.id).catch((error: unknown) => {
            Alert.alert('Couldn’t delete post', errorMessage(error, 'Please try again.'));
          });
        },
      },
    ]);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    if (feedOffline) {
      Alert.alert('You’re offline', 'Reconnect to report this post.');
      return;
    }
    setReporting(true);
    try {
      const created = await reportPost(reportTarget, reportReason);
      setReportTarget(null);
      Alert.alert(
        created ? 'Report received' : 'Already reported',
        created ? 'Thank you for helping keep the community safe.' : 'You have already reported this post.',
      );
    } catch (error) {
      Alert.alert('Couldn’t report post', errorMessage(error, 'Please try again.'));
    } finally {
      setReporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 104 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(380)} style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Community</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Real stories. Kind support. Stronger together.</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => setSearchOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close community search' : 'Search community posts'}
          >
            <Ionicons name={searchOpen ? 'close' : 'search'} size={21} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: actionColor }]}
            onPress={() => setComposerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create a community post"
          >
            <Ionicons name="add" size={22} color={actionTextColor} />
            <Text style={[styles.createButtonText, { color: actionTextColor }]}>Post</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(45).duration(420)}
          style={[styles.communityBanner, { backgroundColor: colors.primary }]}
        >
          <View style={styles.communityBannerCopy}>
            <View style={styles.communityBannerBadge}>
              <Ionicons name="heart" size={12} color="#0A755C" />
              <Text style={styles.communityBannerBadgeText}>YOU BELONG HERE</Text>
            </View>
            <Text style={[styles.communityBannerTitle, { color: '#FFFFFF' }]}>
              Find your people.
            </Text>
            <Text style={[styles.communityBannerSubtitle, { color: '#E8FFF7' }]}>
              Share a win, ask a question, or just say hello.
            </Text>
          </View>
          <Image
            source={require('@/assets/images/disability-illustration.png')}
            style={styles.communityBannerImage}
            resizeMode="contain"
            accessible={false}
          />
        </Animated.View>

        {searchOpen ? (
          <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <Ionicons name="search" size={19} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search posts, people, topics"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              accessibilityLabel="Search community posts"
            />
            {!!searchQuery && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={19} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={[styles.startPostPanel, { backgroundColor: '#FFF8EA' }]}>
          <View style={[styles.startPostPanelHeader, { borderBottomColor: '#E8DFC9' }]}>
            <Text style={[styles.startPostPanelTitle, { color: colors.text }]}>Start a conversation</Text>
            <Ionicons name="chatbubbles-outline" size={19} color={colors.primary} />
          </View>
          <TouchableOpacity
            style={[styles.startPostCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => setComposerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Start a community post"
            activeOpacity={0.82}
          >
            <View style={[styles.startPostAvatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.startPostInitial, { color: colors.primary }]}>
                {authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.startPostPrompt, { color: colors.textSecondary }]}>
              What would you like to share?
            </Text>
            <Ionicons name="images-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.feedHeading}>
          <View>
            <Text style={[styles.feedTitle, { color: colors.text }]}>Community feed</Text>
          </View>
          <TouchableOpacity
            style={[styles.sortControl, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => setSortOrder((current) => current === 'newest' ? 'oldest' : 'newest')}
            accessibilityRole="button"
            accessibilityLabel={`Sort posts: ${sortOrder}. Tap to change.`}
          >
            <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort</Text>
            <Text style={[styles.sortValue, { color: colors.text }]}>
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </Text>
            <Ionicons name="chevron-down" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => {
            const selected = filter === item;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.filterChip,
                  { backgroundColor: selected ? actionColor : colors.backgroundElement, borderColor: selected ? actionColor : colors.border },
                ]}
                onPress={() => setFilter(item)}
                accessibilityRole="button"
                accessibilityLabel={`Filter posts: ${item}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.filterText, { color: selected ? actionTextColor : colors.text }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {conditionUnavailable ? (
          <View style={[styles.stateCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <Ionicons name="medical-outline" size={28} color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.text }]}>No condition category yet</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              Add your detected category in your profile to see posts from people with a similar condition.
            </Text>
          </View>
        ) : loadingFeed ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} size="large" accessibilityLabel="Loading community posts" />
        ) : (
          <>
            {!!currentError && (
                <View style={[styles.errorNotice, { backgroundColor: rulesDenied ? colors.warning + '1A' : colors.danger + '18' }]}>
                  <Ionicons
                    name={rulesDenied ? 'shield-outline' : 'cloud-offline-outline'}
                    size={22}
                    color={rulesDenied ? colors.warning : colors.danger}
                  />
                  <Text style={[styles.errorText, { color: rulesDenied ? colors.text : colors.danger }]}>{currentError}</Text>
                </View>
              )}
            {feedOffline && !currentError && (
              <View style={[styles.errorNotice, { backgroundColor: colors.warning + '1A' }]}>
                <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
                <Text style={[styles.errorText, { color: colors.text }]}>Offline: showing posts currently available on this device.</Text>
              </View>
            )}
            {visiblePosts.length === 0 && !currentError ? (
              <View style={[styles.stateCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Ionicons name={searchQuery ? 'search-outline' : 'chatbubbles-outline'} size={32} color={colors.primary} />
                <Text style={[styles.stateTitle, { color: colors.text }]}>
                  {searchQuery ? 'No matching posts' : 'Be the first to share something'}
                </Text>
                <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'Try another search or choose a different topic.' : 'Your experience may help someone feel less alone.'}
                </Text>
                <TouchableOpacity
                  style={[styles.stateAction, { backgroundColor: actionColor }]}
                  onPress={() => searchQuery ? setSearchQuery('') : setComposerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={searchQuery ? 'Clear community search' : 'Create the first community post'}
                >
                  <Text style={[styles.stateActionText, { color: actionTextColor }]}>
                    {searchQuery ? 'Clear search' : 'Write a post'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : visiblePosts.map((post, index) => (
              <Animated.View key={post.id} entering={FadeInDown.delay(Math.min(index * 45, 270)).duration(380)}>
              <PostCard
                post={post}
                currentUserId={user ?? ''}
                offline={feedOffline}
                authorName={authorName}
                onLike={() => togglePostLike(post.id)}
                onDelete={() => confirmDeletePost(post)}
                onReport={() => {
                  setReportTarget(post.id);
                  setReportReason('Spam');
                }}
              />
              </Animated.View>
            ))}
            {canLoadMore && (
              <TouchableOpacity
                style={[styles.loadMore, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}
                onPress={() => void handleLoadMore()}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load more community posts"
              >
                {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load more</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <SafeAreaView style={[styles.modalScreen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={styles.composerKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.composerContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeading}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Start a conversation</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Your experience can help someone feel less alone.</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setComposerOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close post editor"
                >
                  <Ionicons name="close" size={26} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.postInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text }]}
                value={text}
                onChangeText={(value) => setText(value.slice(0, 500))}
                placeholder="What’s on your mind?"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                textAlignVertical="top"
                accessibilityLabel="Post text, maximum 500 characters"
              />
              <Text style={[styles.counter, { color: colors.textSecondary }]}>{text.length}/500 characters</Text>
              {postImage ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: postImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setPostImage(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached photo"
                  >
                    <Ionicons name="close" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.attachPhotoButton, { borderColor: colors.border, backgroundColor: colors.backgroundSelected }]}
                  onPress={() => void pickPostImage()}
                  accessibilityRole="button"
                  accessibilityLabel="Attach a photo"
                >
                  <View style={[styles.attachIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="image-outline" size={21} color={colors.primary} />
                  </View>
                  <View style={styles.attachCopy}>
                    <Text style={[styles.attachTitle, { color: colors.text }]}>Add a photo</Text>
                    <Text style={[styles.attachSubtitle, { color: colors.textSecondary }]}>Share a moment with your community</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={23} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Choose a category</Text>
              <View style={styles.chipsWrap}>
                {POST_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, { backgroundColor: selectedCategory === category ? actionColor : colors.backgroundElement, borderColor: selectedCategory === category ? actionColor : colors.border }]}
                    onPress={() => setSelectedCategory(category)}
                    accessibilityRole="button"
                    accessibilityLabel={`Post category: ${category}`}
                    accessibilityState={{ selected: selectedCategory === category }}
                  >
                    <Text style={[styles.filterText, { color: selectedCategory === category ? actionTextColor : colors.text }]}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.anonymousRow, { borderColor: colors.border }]}
                onPress={() => setAnonymous((value) => !value)}
                accessibilityRole="switch"
                accessibilityLabel="Post anonymously"
                accessibilityState={{ checked: anonymous }}
              >
                <Ionicons name={anonymous ? 'eye-off-outline' : 'person-outline'} size={24} color={colors.primary} />
                <Text style={[styles.anonymousLabel, { color: colors.text }]}>Post anonymously</Text>
                <View style={[styles.switchTrack, { backgroundColor: anonymous ? colors.primary : colors.backgroundSelected }]}>
                  <View style={[styles.switchThumb, { alignSelf: anonymous ? 'flex-end' : 'flex-start' }]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: actionColor, opacity: posting ? 0.7 : 1 }]}
                onPress={() => void submitPost()}
                disabled={posting}
                accessibilityRole="button"
                accessibilityLabel="Publish community post"
              >
                {posting ? <ActivityIndicator color={actionTextColor} /> : <Text style={[styles.submitText, { color: actionTextColor }]}>Share with community</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(reportTarget)} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.reportPanel, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Report this post</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>Choose the reason that best describes your concern.</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reportReason, { borderColor: reportReason === reason ? colors.primary : colors.border }]}
                onPress={() => setReportReason(reason)}
                accessibilityRole="radio"
                accessibilityLabel={`Report reason: ${reason}`}
                accessibilityState={{ selected: reportReason === reason }}
              >
                <Ionicons name={reportReason === reason ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
                <Text style={[styles.filterText, { color: colors.text }]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: actionColor }]}
              onPress={() => void submitReport()}
              disabled={reporting}
              accessibilityRole="button"
              accessibilityLabel="Submit report"
            >
              {reporting ? <ActivityIndicator color={actionTextColor} /> : <Text style={[styles.submitText, { color: actionTextColor }]}>Submit report</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setReportTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
            >
              <Text style={[styles.filterText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  currentUserId,
  offline,
  authorName,
  onLike,
  onDelete,
  onReport,
}: {
  post: CommunityPost;
  currentUserId: string;
  offline: boolean;
  authorName: string;
  onLike: () => Promise<boolean>;
  onDelete: () => void;
  onReport: () => void;
}) {
  const colors = useTheme();
  const [liked, setLiked] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    if (!post.imagePath) {
      setImageUrl(null);
      return;
    }
    void getCommunityImageUrl(post.imagePath).then((url) => {
      if (active) setImageUrl(url);
    }).catch((error: unknown) => {
      console.warn('[Community] Could not load post image:', error);
      if (active) setActionError('Couldn’t load this post photo.');
    });
    return () => {
      active = false;
    };
  }, [post.imagePath]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void subscribeToPostLike(
      post.id,
      (value) => {
        if (active) setLiked(value);
      },
      () => {
        if (active) setActionError('Couldn’t check your like status. Try again when online.');
      },
    ).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    }).catch(() => {
      if (active) setActionError('Couldn’t check your like status. Try again when online.');
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [post.id]);

  useEffect(() => {
    if (!commentsOpen) return;
    return subscribeToComments(
      post.id,
      setComments,
      () => setActionError('Couldn’t load comments. Please reconnect and try again.'),
    );
  }, [commentsOpen, post.id]);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    setActionError('');
    try {
      await createComment(post.id, { text: commentText, authorName });
      setCommentText('');
    } catch (error) {
      setActionError(errorMessage(error, 'Couldn’t add your comment.'));
    } finally {
      setCommenting(false);
    }
  };

  const likePost = async () => {
    setActionError('');
    try {
      await onLike();
    } catch (error) {
      setActionError(errorMessage(error, 'Couldn’t update your like.'));
    }
  };

  const sharePost = async () => {
    try {
      await Share.share({
        message: [post.text, imageUrl].filter(Boolean).join('\n\n') || 'Check out this community post.',
      });
    } catch (error) {
      console.error('[Community] Could not share post:', error);
      setActionError('Couldn’t share this post right now.');
    }
  };

  return (
    <View style={[styles.postCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name={post.isAnonymous ? 'eye-off-outline' : 'person-outline'} size={22} color={colors.primary} />
        </View>
        <View style={styles.postAuthor}>
          <Text style={[styles.authorName, { color: colors.text }]}>
            {post.isAnonymous ? 'Anonymous' : post.authorId === currentUserId ? authorName : post.authorName}
          </Text>
          <View style={styles.postMetadata}>
            <View style={[styles.postCategoryBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.postCategoryText, { color: colors.primary }]}>{post.category}</Text>
            </View>
            <Text style={[styles.postMeta, { color: colors.textSecondary }]}>{timeLabel(post.createdAt)}</Text>
          </View>
        </View>
        {post.authorId === currentUserId ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onDelete}
            disabled={offline}
            accessibilityRole="button"
            accessibilityLabel="Delete your post"
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onReport}
            disabled={offline}
            accessibilityRole="button"
            accessibilityLabel="Report this post"
          >
            <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {post.text ? <Text style={[styles.postBody, { color: colors.text }]}>{post.text}</Text> : null}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
          accessibilityLabel="Photo attached to community post"
        />
      ) : null}
      {!!actionError && <Text style={[styles.inlineError, { color: colors.danger }]}>{actionError}</Text>}
      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.postAction}
          onPress={() => void likePost()}
          disabled={offline}
          accessibilityRole="button"
          accessibilityLabel={`${liked ? 'Unlike' : 'Like'} post, ${post.likeCount} likes`}
          accessibilityState={{ selected: liked }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.danger : colors.textSecondary} />
          <Text style={[styles.actionText, { color: liked ? colors.danger : colors.textSecondary }]}>{post.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.postAction}
          onPress={() => setCommentsOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`${commentsOpen ? 'Hide' : 'Show'} comments, ${post.commentCount} comments`}
          accessibilityState={{ expanded: commentsOpen }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>{post.commentCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.postAction}
          onPress={() => void sharePost()}
          accessibilityRole="button"
          accessibilityLabel="Share this post"
        >
          <Ionicons name="share-social-outline" size={19} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Share</Text>
        </TouchableOpacity>
      </View>
      {commentsOpen && (
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
        {offline && <Text style={[styles.inlineError, { color: colors.textSecondary }]}>Reconnect to add or delete comments.</Text>}
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.commentAuthor, { color: colors.text }]}>
                  {comment.isAnonymous ? 'Anonymous' : comment.authorId === currentUserId ? authorName : comment.authorName}
                </Text>
                <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{comment.text}</Text>
              </View>
              {comment.authorId === currentUserId && (
                <TouchableOpacity
                  style={styles.commentDelete}
                  onPress={() => {
                    void deleteComment(post.id, comment.id).catch((error: unknown) => {
                      setActionError(errorMessage(error, 'Couldn’t delete your comment.'));
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Delete your comment"
                >
                  <Ionicons name="trash-outline" size={21} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {comments.length === 0 && <Text style={[styles.commentBody, { color: colors.textSecondary }]}>No comments yet.</Text>}
          <View style={styles.commentComposer}>
            <TextInput
              style={[styles.commentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={commentText}
              onChangeText={(value) => setCommentText(value.slice(0, 300))}
              maxLength={300}
              placeholder="Write a comment"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Comment text, maximum 300 characters"
            />
            <TouchableOpacity
              style={[styles.commentSend, { backgroundColor: colors.primary }]}
              onPress={() => void submitComment()}
              disabled={offline || commenting || !commentText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              {commenting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={21} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          <Text style={[styles.counter, { color: colors.textSecondary }]}>{commentText.length}/300 characters</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 0 },
  headerText: { flex: 1 },
  title: { fontFamily: Fonts.sans, fontSize: 26, lineHeight: 33, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, marginTop: 1 },
  createButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4, elevation: 3, shadowColor: '#087F5B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', fontFamily: Fonts.sans },
  headerIconButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  communityBanner: { minHeight: 124, borderRadius: 23, paddingLeft: 16, paddingVertical: 9, paddingRight: 4, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  communityBannerCopy: { flex: 1, gap: 5, zIndex: 1 },
  communityBannerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D9F8EC', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  communityBannerBadgeText: { color: '#0A755C', fontFamily: Fonts.sans, fontSize: 8, letterSpacing: 0.8, fontWeight: '900' },
  communityBannerTitle: { fontFamily: Fonts.sans, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  communityBannerSubtitle: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 16, maxWidth: 200 },
  communityBannerImage: { width: 106, height: 122, marginLeft: -8 },
  searchBar: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, paddingVertical: 10 },
  startPostPanel: { borderRadius: 19, padding: 6, gap: 5 },
  startPostPanelHeader: { minHeight: 25, paddingHorizontal: 5, paddingBottom: 3, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startPostPanelTitle: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  startPostCard: { minHeight: 46, borderWidth: 1, borderRadius: 15, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  startPostAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  startPostInitial: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  startPostPrompt: { flex: 1, fontFamily: Fonts.sans, fontSize: 13 },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
  feedTitle: { fontFamily: Fonts.sans, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  feedSubtitle: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, marginTop: 2 },
  feedIconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sortControl: { minHeight: 38, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: { fontFamily: Fonts.sans, fontSize: 12 },
  sortValue: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700' },
  filters: { gap: 8, paddingVertical: 2, paddingRight: 18 },
  filterChip: { minHeight: 40, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
  filterText: { fontSize: 13, lineHeight: 18, fontWeight: '700', fontFamily: Fonts.sans },
  loader: { marginTop: 40 },
  stateCard: { padding: 24, borderRadius: 22, borderWidth: 1, alignItems: 'center', gap: 10 },
  stateTitle: { fontSize: 19, lineHeight: 26, fontWeight: '800', textAlign: 'center', fontFamily: Fonts.sans },
  stateText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontFamily: Fonts.sans },
  stateAction: { minHeight: 48, paddingHorizontal: 22, borderRadius: 15, justifyContent: 'center', marginTop: 4 },
  stateActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontFamily: Fonts.sans },
  errorNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 21 },
  postCard: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 12, shadowColor: '#122B22', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.055, shadowRadius: 10, elevation: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  postAuthor: { flex: 1 },
  authorName: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  postMetadata: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  postCategoryBadge: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  postCategoryText: { fontFamily: Fonts.sans, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  postMeta: { fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16 },
  iconButton: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  postBody: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23, letterSpacing: 0.05, fontWeight: '400' },
  postImage: { width: '100%', height: 230, borderRadius: 16, backgroundColor: '#EDF6EF' },
  inlineError: { fontSize: 13, lineHeight: 19 },
  postActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 5, marginTop: 1 },
  postAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, marginRight: 12 },
  actionText: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans },
  commentsSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  commentBody: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  commentDelete: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  commentComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, minHeight: 56, maxHeight: 112, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, fontSize: 16 },
  commentSend: { width: 56, height: 56, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  counter: { textAlign: 'right', fontSize: 13, lineHeight: 18 },
  loadMore: { minHeight: 56, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontSize: 16, fontWeight: '700' },
  modalScreen: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  composerKeyboard: { flex: 1 },
  composerContent: { gap: 14, paddingBottom: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalHeading: { flex: 1, gap: 3 },
  modalTitle: { fontSize: 23, lineHeight: 30, fontWeight: '800', flex: 1, fontFamily: Fonts.sans },
  modalSubtitle: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.sans },
  closeButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  postInput: { minHeight: 145, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 16, lineHeight: 24 },
  fieldLabel: { fontSize: 15, lineHeight: 21, fontWeight: '800', fontFamily: Fonts.sans },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 40, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, justifyContent: 'center' },
  attachPhotoButton: { minHeight: 72, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  attachIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  attachCopy: { flex: 1, gap: 2 },
  attachTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', fontFamily: Fonts.sans },
  attachSubtitle: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.sans },
  imagePreviewWrap: { position: 'relative' },
  imagePreview: { height: 220, width: '100%', borderRadius: 17, backgroundColor: '#EDF6EF' },
  removeImageButton: { position: 'absolute', top: 9, right: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: '#15231FBB', alignItems: 'center', justifyContent: 'center' },
  anonymousRow: { minHeight: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  anonymousLabel: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
  switchTrack: { width: 48, height: 28, borderRadius: 16, padding: 4, justifyContent: 'center' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  submitButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '800', fontFamily: Fonts.sans },
  modalBackdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 20 },
  reportPanel: { borderRadius: 22, padding: 20, gap: 10 },
  reportReason: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelButton: { minHeight: 56, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
