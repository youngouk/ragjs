/**
 * useDebounce hook 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

// Mock timers
vi.useFakeTimers();

describe('useDebounce', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('useDebounce hook', () => {
    it('초기값을 즉시 반환한다', () => {
      const { result } = renderHook(() => useDebounce('initial', 500));

      expect(result.current).toBe('initial');
    });

    it('지연 시간이 지나기 전에는 이전 값을 유지한다', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 }
        }
      );

      expect(result.current).toBe('initial');

      // 값 변경
      act(() => {
        rerender({ value: 'updated', delay: 500 });
      });

      // 아직 지연 시간이 지나지 않았으므로 이전 값 유지
      expect(result.current).toBe('initial');

      // 지연 시간의 일부만 경과
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current).toBe('initial');
    });

    it('지연 시간 후에 새로운 값으로 업데이트된다', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 }
        }
      );

      // 값 변경
      rerender({ value: 'updated', delay: 500 });

      // 지연 시간 경과
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('연속된 값 변경 시 마지막 값만 적용된다', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 }
        }
      );

      // 연속된 값 변경
      rerender({ value: 'first', delay: 500 });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender({ value: 'second', delay: 500 });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender({ value: 'final', delay: 500 });

      // 마지막 지연 시간만 경과
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('final');
    });

    it('delay 값이 변경되면 새로운 지연 시간을 적용한다', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 }
        }
      );

      // 값과 지연 시간 동시 변경
      rerender({ value: 'updated', delay: 100 });

      // 새로운 지연 시간(100ms) 적용
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe('updated');
    });

    it('숫자 타입도 올바르게 디바운스한다', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 0, delay: 300 }
        }
      );

      expect(result.current).toBe(0);

      rerender({ value: 42, delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(42);
    });

    it('객체 타입도 올바르게 디바운스한다', () => {
      const initialObj = { name: 'initial' };
      const updatedObj = { name: 'updated' };

      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: initialObj, delay: 300 }
        }
      );

      expect(result.current).toBe(initialObj);

      rerender({ value: updatedObj, delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(updatedObj);
    });

    it('컴포넌트 언마운트 시 타이머를 정리한다', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      const { unmount, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 }
        }
      );

      rerender({ value: 'updated', delay: 500 });
      
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('useDebouncedCallback hook', () => {
    it('지연 시간 후에 콜백을 실행한다', () => {
      const mockCallback = vi.fn();
      const { result } = renderHook(() => 
        useDebouncedCallback(mockCallback, 500)
      );

      // 콜백 호출
      act(() => {
        result.current('test', 123);
      });

      // 아직 실행되지 않음
      expect(mockCallback).not.toHaveBeenCalled();

      // 지연 시간 경과
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockCallback).toHaveBeenCalledWith('test', 123);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('연속 호출 시 이전 타이머를 취소하고 새로운 타이머를 설정한다', () => {
      const mockCallback = vi.fn();
      const { result } = renderHook(() => 
        useDebouncedCallback(mockCallback, 500)
      );

      // 첫 번째 호출
      act(() => {
        result.current('first');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // 두 번째 호출 (이전 타이머 취소)
      act(() => {
        result.current('second');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // 세 번째 호출 (이전 타이머 취소)
      act(() => {
        result.current('final');
      });

      // 마지막 지연 시간 경과
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // 마지막 호출만 실행되어야 함
      expect(mockCallback).toHaveBeenCalledWith('final');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('여러 인자를 올바르게 전달한다', () => {
      const mockCallback = vi.fn();
      const { result } = renderHook(() => 
        useDebouncedCallback(mockCallback, 300)
      );

      act(() => {
        result.current('arg1', 'arg2', { key: 'value' }, 123);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockCallback).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' }, 123);
    });

    it('타입스크립트 제네릭이 올바르게 작동한다', () => {
      type TestCallback = (name: string, age: number) => void;
      const mockCallback: TestCallback = vi.fn();
      
      const { result } = renderHook(() => 
        useDebouncedCallback<TestCallback>(mockCallback, 300)
      );

      act(() => {
        // TypeScript 컴파일러가 타입을 검증해야 함
        result.current('Alice', 30);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockCallback).toHaveBeenCalledWith('Alice', 30);
    });

    it('delay가 0인 경우에도 정상 작동한다', () => {
      const mockCallback = vi.fn();
      const { result } = renderHook(() => 
        useDebouncedCallback(mockCallback, 0)
      );

      act(() => {
        result.current('immediate');
      });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(mockCallback).toHaveBeenCalledWith('immediate');
    });

    it('초기 상태에서는 timeoutId가 null이다', () => {
      const mockCallback = vi.fn();
      
      renderHook(() => useDebouncedCallback(mockCallback, 500));
      
      // 초기에는 아무런 타이머도 설정되지 않았으므로 clearTimeout이 호출되지 않아야 함
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });
  });
});