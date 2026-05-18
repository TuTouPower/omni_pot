// Re-exports the host's global React (UMD-loaded) as an ESM module so that
// esm.sh-loaded packages compiled with `?external=react` resolve to the SAME
// React instance the host app uses. Without this, react-icons gets its own
// bundled React copy whose `$$typeof` Symbol does not match ours, and the host
// rejects every element it produces.
const R = window.React;
export default R;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createFactory, createRef,
  forwardRef, isValidElement, lazy, memo,
  startTransition,
  useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId,
  useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer,
  useRef, useState, useSyncExternalStore, useTransition,
  version,
} = R;
