import { useCallback, useMemo, useState } from 'react';
import { RepEngine } from './RepEngine';
import type { EngineState, FrameInput } from './RepEngine';
import type { ExerciseId, Level } from './config';

const sameState = (a: EngineState, b: EngineState) =>
  a.reps === b.reps &&
  a.cleanReps === b.cleanReps &&
  a.phase === b.phase &&
  a.side === b.side &&
  a.poseVisible === b.poseVisible &&
  a.feedback === b.feedback &&
  (a.angle === null ? b.angle === null : b.angle !== null && Math.round(a.angle) === Math.round(b.angle));

export function useRepCounter(exercise: ExerciseId, level: Level = 'intermediate') {
  const engine = useMemo(() => new RepEngine(exercise, level), [exercise, level]);
  const [storedState, setStoredState] = useState(() => ({
    engine,
    state: engine.snapshot(),
  }));
  const state = storedState.engine === engine ? storedState.state : engine.snapshot();

  const onFrame = useCallback(
    (frame: FrameInput | null) => {
      const next = engine.update(frame);
      setStoredState((previous) => {
        const previousState =
          previous.engine === engine ? previous.state : engine.snapshot();
        return sameState(previousState, next)
          ? previous
          : { engine, state: next };
      });
      return next;
    },
    [engine],
  );

  const reset = useCallback(() => {
    engine.reset();
    setStoredState({ engine, state: engine.snapshot() });
  }, [engine]);

  return { ...state, onFrame, reset };
}
