/**
 * useVirtualList hook 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualList } from '../useVirtualList';

describe('useVirtualList', () => {
  const mockItems = Array.from({ length: 1000 }, (_, index) => ({
    id: index,
    name: `Item ${index}`,
    value: index * 10
  }));

  const defaultOptions = {
    itemHeight: 50,
    containerHeight: 300,
    overscan: 5
  };

  describe('초기 상태', () => {
    it('초기 렌더링 시 올바른 값들을 반환한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      expect(result.current.totalHeight).toBe(50000); // 1000 * 50
      expect(result.current.offsetY).toBe(0); // startIndex * itemHeight
      expect(result.current.startIndex).toBe(0);
      // visibleCount = Math.ceil(300 / 50) = 6
      // startIndex = Math.max(0, 0 - 5) = 0
      // endIndex = Math.min(999, 0 + 6 + 10) = 16
      expect(result.current.endIndex).toBe(16);
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
    });

    it('빈 배열에 대해서도 올바르게 처리한다', () => {
      const { result } = renderHook(() => 
        useVirtualList([], defaultOptions)
      );

      expect(result.current.totalHeight).toBe(0);
      expect(result.current.offsetY).toBe(0);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(-1); // Math.min(-1, ...)
      expect(result.current.visibleItems).toEqual([]);
    });

    it('overscan 기본값이 5로 설정된다', () => {
      const optionsWithoutOverscan = {
        itemHeight: 50,
        containerHeight: 300
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, optionsWithoutOverscan)
      );

      // overscan이 적용된 범위를 확인
      expect(result.current.startIndex).toBe(0); // Math.max(0, 0 - 5)
      expect(result.current.endIndex).toBeGreaterThan(5); // overscan * 2가 추가됨
    });
  });

  describe('가상화 계산', () => {
    it('scrollTop이 변경되면 visibleRange가 업데이트된다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const initialStartIndex = result.current.startIndex;
      const initialEndIndex = result.current.endIndex;

      // 스크롤 이벤트 시뮬레이션
      const mockScrollEvent = {
        currentTarget: { scrollTop: 500 }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(mockScrollEvent);
      });

      // 스크롤 후 범위가 변경되었는지 확인
      expect(result.current.startIndex).not.toBe(initialStartIndex);
      expect(result.current.endIndex).not.toBe(initialEndIndex);
      expect(result.current.offsetY).toBe(result.current.startIndex * 50);
    });

    it('다양한 itemHeight에 대해 올바르게 계산한다', () => {
      const options = {
        itemHeight: 100,
        containerHeight: 400,
        overscan: 2
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, options)
      );

      expect(result.current.totalHeight).toBe(100000); // 1000 * 100
      
      // visibleCount = Math.ceil(400 / 100) = 4
      // startIndex = Math.max(0, 0 - 2) = 0
      // endIndex = Math.min(999, 0 + 4 + 4) = 8
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(8);
    });

    it('containerHeight가 작을 때도 올바르게 처리한다', () => {
      const options = {
        itemHeight: 50,
        containerHeight: 100,
        overscan: 1
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, options)
      );

      // visibleCount = Math.ceil(100 / 50) = 2
      // startIndex = Math.max(0, 0 - 1) = 0
      // endIndex = Math.min(999, 0 + 2 + 2) = 4
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(4);
      expect(result.current.visibleItems.length).toBe(5); // endIndex - startIndex + 1
    });
  });

  describe('스크롤 처리', () => {
    it('handleScroll이 scrollTop을 올바르게 업데이트한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const scrollTop = 1000;
      const mockScrollEvent = {
        currentTarget: { scrollTop }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(mockScrollEvent);
      });

      // scrollTop = 1000, itemHeight = 50이므로
      // startIndex = Math.max(0, Math.floor(1000/50) - 5) = Math.max(0, 15) = 15
      expect(result.current.startIndex).toBe(15);
      expect(result.current.offsetY).toBe(750); // 15 * 50
    });

    it('스크롤이 끝에 도달했을 때 올바르게 처리한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      // 맨 끝으로 스크롤
      const scrollTop = 50000; // totalHeight와 같거나 더 큰 값
      const mockScrollEvent = {
        currentTarget: { scrollTop }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(mockScrollEvent);
      });

      expect(result.current.endIndex).toBe(999); // items.length - 1
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
    });

    it('음수 스크롤 값도 올바르게 처리한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const mockScrollEvent = {
        currentTarget: { scrollTop: -100 }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(mockScrollEvent);
      });

      // Math.max(0, ...)로 인해 startIndex는 0 이상이어야 함
      expect(result.current.startIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('visibleItems 계산', () => {
    it('visibleItems가 올바른 아이템들을 포함한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const { startIndex, endIndex, visibleItems } = result.current;
      
      expect(visibleItems.length).toBe(endIndex - startIndex + 1);
      expect(visibleItems[0]).toEqual(mockItems[startIndex]);
      expect(visibleItems[visibleItems.length - 1]).toEqual(mockItems[endIndex]);
    });

    it('아이템 배열이 변경되면 visibleItems가 업데이트된다', () => {
      const initialItems = mockItems.slice(0, 100);
      const { result, rerender } = renderHook(
        ({ items }) => useVirtualList(items, defaultOptions),
        { initialProps: { items: initialItems } }
      );

      // 초기 상태 확인
      expect(result.current.visibleItems.length).toBeGreaterThan(0);

      // 아이템 배열 변경
      const updatedItems = [...initialItems, { id: 100, name: 'New Item', value: 1000 }];
      rerender({ items: updatedItems });

      const updatedVisibleItems = result.current.visibleItems;
      
      // 변경된 배열의 첫 번째 아이템이 같은지 확인
      expect(updatedVisibleItems[0]).toEqual(updatedItems[0]);
      expect(result.current.totalHeight).toBe(101 * 50); // 새로운 totalHeight
    });

    it('아이템이 하나도 없는 범위에서도 빈 배열을 반환한다', () => {
      const emptyItems: Array<{ id: number; name: string; value: number }> = [];
      const { result } = renderHook(() => 
        useVirtualList(emptyItems, defaultOptions)
      );

      expect(result.current.visibleItems).toEqual([]);
      expect(result.current.totalHeight).toBe(0);
    });
  });

  describe('메모이제이션', () => {
    it('동일한 props로 리렌더링 시 visibleItems 참조가 유지된다', () => {
      const { result, rerender } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const firstRender = result.current.visibleItems;
      
      // 동일한 props로 리렌더링
      rerender();
      
      const secondRender = result.current.visibleItems;
      
      expect(firstRender).toBe(secondRender); // 참조 동일성 확인
    });

    it('scrollTop이 변경되면 새로운 visibleItems를 생성한다', () => {
      const { result } = renderHook(() => 
        useVirtualList(mockItems, defaultOptions)
      );

      const initialVisibleItems = result.current.visibleItems;
      
      // 스크롤 변경
      const mockScrollEvent = {
        currentTarget: { scrollTop: 300 }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(mockScrollEvent);
      });

      const updatedVisibleItems = result.current.visibleItems;
      
      expect(initialVisibleItems).not.toBe(updatedVisibleItems); // 참조가 달라야 함
    });
  });

  describe('경계 조건', () => {
    it('overscan이 0일 때도 정상 작동한다', () => {
      const options = {
        itemHeight: 50,
        containerHeight: 300,
        overscan: 0
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, options)
      );

      expect(result.current.startIndex).toBe(0);
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
    });

    it('itemHeight가 containerHeight보다 클 때도 올바르게 처리한다', () => {
      const options = {
        itemHeight: 500, // containerHeight보다 큰 값
        containerHeight: 300,
        overscan: 1
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, options)
      );

      // visibleCount = Math.ceil(300 / 500) = 1
      expect(result.current.totalHeight).toBe(500000); // 1000 * 500
      expect(result.current.visibleItems.length).toBeGreaterThanOrEqual(1);
    });

    it('매우 큰 overscan 값도 처리할 수 있다', () => {
      const options = {
        itemHeight: 50,
        containerHeight: 300,
        overscan: 1000 // 매우 큰 값
      };

      const { result } = renderHook(() => 
        useVirtualList(mockItems, options)
      );

      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(999); // items.length - 1을 초과할 수 없음
      expect(result.current.visibleItems.length).toBe(1000); // 모든 아이템
    });
  });
});