import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useCategory } from '@/store/AuthContext';
import { fetchUserProfile } from '@/services/authService';
import {
  createComment,
  createCommunityPost,
  deleteComment,
  deleteCommunityPost,
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

const NOT_MEDICAL_ADVICE =
  'Posts here are personal experiences, not medical advice. Please ask your doctor before changing medicines, exercises or diet.';

type FeedFilter = 'All' | PostCategory | 'My condition';
const FILTERS: FeedFilter[] = ['All', ...POST_CATEGORIES, 'My condition'];
const REPORT_REASONS: ReportReason[] = ['Spam', 'Harassment', 'Unsafe medical advice', 'Other'];

function errorMessage(error: unknown, fallback: string): string {
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
  const actionColor = colors.primary === '#38BDF8' ? colors.primary : '#0369A1';
  const actionTextColor = colors.primary === '#38BDF8' ? '#0F172A' : '#FFFFFF';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { category: condition } = useCategory();
  const [filter, setFilter] = useState<FeedFilter>('All');
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
  const feedKey = `${filter}:${condition ?? ''}`;
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

  useEffect(() => {
    let active = true;
    if (!user) return;
    void fetchUserProfile(user).then((profile) => {
      if (!active) return;
      const username = profile?.username;
      if (typeof username === 'string' && username.trim()) {
        setAuthorName(safeFirstName(username));
      }
    }).catch(() => {
      if (active) setAuthorName('Community member');
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (conditionUnavailable) {
      return;
    }

    const unsubscribe = subscribeToPosts(
      selectedPostCategory,
      selectedCondition,
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
  }, [conditionUnavailable, feedKey, selectedCondition, selectedPostCategory]);

  const visiblePosts = useMemo(() => posts.filter((post) => !post.hidden), [posts]);

  const handleLoadMore = async () => {
    const cursor = snapshots[snapshots.length - 1];
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const page = await loadMorePosts(selectedPostCategory, selectedCondition, cursor);
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
    if (!text.trim()) {
      Alert.alert('Add a message', 'Write something before posting.');
      return;
    }
    setPosting(true);
    try {
      await createCommunityPost({
        text,
        authorName,
        isAnonymous: anonymous,
        category: selectedCategory,
        conditionCategory: condition,
      });
      setText('');
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
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Community</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Share, learn and support one another</Text>
          </View>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: actionColor }]}
            onPress={() => setComposerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create a community post"
          >
            <Ionicons name="add" size={24} color={actionTextColor} />
            <Text style={[styles.createButtonText, { color: actionTextColor }]}>Post</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.disclaimer, { backgroundColor: colors.warning + '1A', borderColor: colors.warning }]}>
          <Ionicons name="information-circle" size={24} color={colors.warning} />
          <Text style={[styles.disclaimerText, { color: colors.text }]}>{NOT_MEDICAL_ADVICE}</Text>
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
                <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
                <Text style={[styles.stateTitle, { color: colors.text }]}>Be the first to share something</Text>
                <Text style={[styles.stateText, { color: colors.textSecondary }]}>Your experience may help someone feel less alone.</Text>
                <TouchableOpacity
                  style={[styles.stateAction, { backgroundColor: actionColor }]}
                  onPress={() => setComposerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Create the first community post"
                >
                  <Text style={[styles.stateActionText, { color: actionTextColor }]}>Write a post</Text>
                </TouchableOpacity>
              </View>
            ) : visiblePosts.map((post) => (
              <PostCard
                key={post.id}
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
          <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create a post</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setComposerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close post editor"
              >
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.disclaimer, { backgroundColor: colors.warning + '1A', borderColor: colors.warning }]}>
              <Ionicons name="information-circle" size={24} color={colors.warning} />
              <Text style={[styles.disclaimerText, { color: colors.text }]}>{NOT_MEDICAL_ADVICE}</Text>
            </View>
            <TextInput
              style={[styles.postInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text }]}
              value={text}
              onChangeText={(value) => setText(value.slice(0, 500))}
              placeholder="What would you like to share?"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
              accessibilityLabel="Post text, maximum 500 characters"
            />
            <Text style={[styles.counter, { color: colors.textSecondary }]}>{text.length}/500 characters</Text>
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
              {posting ? <ActivityIndicator color={actionTextColor} /> : <Text style={[styles.submitText, { color: actionTextColor }]}>Post</Text>}
            </TouchableOpacity>
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
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [actionError, setActionError] = useState('');

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

  return (
    <View style={[styles.postCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name={post.isAnonymous ? 'eye-off-outline' : 'person-outline'} size={22} color={colors.primary} />
        </View>
        <View style={styles.postAuthor}>
          <Text style={[styles.authorName, { color: colors.text }]}>{post.isAnonymous ? 'Anonymous' : post.authorName}</Text>
          <Text style={[styles.postMeta, { color: colors.textSecondary }]}>{post.category} · {timeLabel(post.createdAt)}</Text>
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
      <Text style={[styles.postBody, { color: colors.text }]}>{post.text}</Text>
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
      </View>
      {commentsOpen && (
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
        {offline && <Text style={[styles.inlineError, { color: colors.textSecondary }]}>Reconnect to add or delete comments.</Text>}
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.isAnonymous ? 'Anonymous' : comment.authorName}</Text>
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
  content: { paddingHorizontal: 18, paddingTop: 12, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 2 },
  createButton: { minHeight: 56, paddingHorizontal: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5 },
  createButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disclaimer: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  disclaimerText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  filters: { gap: 9, paddingVertical: 2 },
  filterChip: { minHeight: 56, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, justifyContent: 'center' },
  filterText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  loader: { marginTop: 40 },
  stateCard: { padding: 22, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 10 },
  stateTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  stateText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  stateAction: { minHeight: 56, paddingHorizontal: 22, borderRadius: 14, justifyContent: 'center', marginTop: 4 },
  stateActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  errorNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 21 },
  postCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  postAuthor: { flex: 1 },
  authorName: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  postMeta: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  iconButton: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  postBody: { fontSize: 17, lineHeight: 25 },
  inlineError: { fontSize: 14, lineHeight: 20 },
  postActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  postAction: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, marginRight: 16 },
  actionText: { fontSize: 15, fontWeight: '600' },
  commentsSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  commentBody: { fontSize: 15, lineHeight: 21 },
  commentDelete: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  commentComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, minHeight: 56, maxHeight: 112, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, fontSize: 16 },
  commentSend: { width: 56, height: 56, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  counter: { textAlign: 'right', fontSize: 13, lineHeight: 18 },
  loadMore: { minHeight: 56, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontSize: 16, fontWeight: '700' },
  modalScreen: { flex: 1, padding: 18, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 24, lineHeight: 32, fontWeight: '800', flex: 1 },
  closeButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  postInput: { minHeight: 170, borderWidth: 1, borderRadius: 16, padding: 14, fontSize: 18, lineHeight: 26 },
  fieldLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 56, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, justifyContent: 'center' },
  anonymousRow: { minHeight: 60, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  anonymousLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  switchTrack: { width: 52, height: 30, borderRadius: 16, padding: 4, justifyContent: 'center' },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  submitButton: { minHeight: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 20 },
  reportPanel: { borderRadius: 22, padding: 20, gap: 10 },
  reportReason: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelButton: { minHeight: 56, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
