/**
 * Performance utilities 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  lazyLoadImages,
  deferExecution,
  EventManager,
  memoize,
  BatchQueue,
  calculateVisibleItems
} from '../performance';

// Mock DOM APIs
Object.defineProperty(window, 'requestIdleCallback', {
  writable: true,
  value: vi.fn((callback: () => void) => callback())
});

describe('Performance Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DOM 초기화
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('lazyLoadImages', () => {
    it('Intersection Observer가 지원되는 환경에서 이미지를 지연 로딩한다', () => {
      // Mock Intersection Observer
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      const mockDisconnect = vi.fn();
      
      const mockIntersectionObserver = vi.fn((callback) => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
        callback
      }));
      
      vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

      // data-src 속성을 가진 이미지 요소 생성
      const img1 = document.createElement('img');
      img1.setAttribute('data-src', 'test1.jpg');
      const img2 = document.createElement('img');
      img2.setAttribute('data-src', 'test2.jpg');
      
      document.body.appendChild(img1);
      document.body.appendChild(img2);

      // lazyLoadImages 실행
      lazyLoadImages();

      // IntersectionObserver가 생성되었는지 확인
      expect(mockIntersectionObserver).toHaveBeenCalledOnce();
      
      // 모든 data-src 이미지에 대해 observe가 호출되었는지 확인
      expect(mockObserve).toHaveBeenCalledTimes(2);
      expect(mockObserve).toHaveBeenCalledWith(img1);
      expect(mockObserve).toHaveBeenCalledWith(img2);
    });

    it('교차 시 이미지 src를 설정하고 관찰을 중단한다', () => {
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      let intersectionCallback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;
      
      const mockIntersectionObserver = vi.fn((callback) => {
        intersectionCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: vi.fn()
        };
      });
      
      vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

      // 테스트용 이미지 생성
      const img = document.createElement('img');
      img.setAttribute('data-src', 'test.jpg');
      document.body.appendChild(img);

      lazyLoadImages();

      // 교차 이벤트 시뮬레이션
      const mockEntry = {
        isIntersecting: true,
        target: img
      };
      
      const mockObserverInstance = {
        unobserve: mockUnobserve
      };

      intersectionCallback!([mockEntry], mockObserverInstance);

      // 이미지 src가 설정되었는지 확인
      expect(img.src).toBe('http://localhost:3000/test.jpg'); // jsdom은 상대 경로를 절대 경로로 변환
      
      // unobserve가 호출되었는지 확인
      expect(mockUnobserve).toHaveBeenCalledWith(img);
    });

    it('data-src가 없는 경우 빈 문자열을 설정한다', () => {
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      let intersectionCallback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;
      
      const mockIntersectionObserver = vi.fn((callback) => {
        intersectionCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: vi.fn()
        };
      });
      
      vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

      // data-src 없는 이미지 생성
      const img = document.createElement('img');
      document.body.appendChild(img);

      lazyLoadImages();

      // 교차 이벤트 시뮬레이션
      const mockEntry = {
        isIntersecting: true,
        target: img
      };
      
      const mockObserverInstance = {
        unobserve: mockUnobserve
      };

      intersectionCallback!([mockEntry], mockObserverInstance);

      // 빈 문자열이 설정되었는지 확인 (jsdom은 빈 문자열을 base URL로 변환)
      expect(img.src).toMatch(/^\s*$|^http:\/\/localhost:3000\/$/);  // 빈 문자열 또는 base URL
    });

    it('교차하지 않은 경우 이미지 src를 설정하지 않는다', () => {
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      let intersectionCallback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;
      
      const mockIntersectionObserver = vi.fn((callback) => {
        intersectionCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: vi.fn()
        };
      });
      
      vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

      // 테스트용 이미지 생성
      const img = document.createElement('img');
      img.setAttribute('data-src', 'test.jpg');
      const originalSrc = img.src;
      document.body.appendChild(img);

      lazyLoadImages();

      // 교차하지 않은 이벤트 시뮬레이션
      const mockEntry = {
        isIntersecting: false,
        target: img
      };
      
      const mockObserverInstance = {
        unobserve: mockUnobserve
      };

      intersectionCallback!([mockEntry], mockObserverInstance);

      // src가 변경되지 않았는지 확인
      expect(img.src).toBe(originalSrc);
      
      // unobserve가 호출되지 않았는지 확인
      expect(mockUnobserve).not.toHaveBeenCalled();
    });

    it('IntersectionObserver가 지원되지 않는 환경에서는 아무것도 하지 않는다', () => {
      // window에서 IntersectionObserver 속성을 제거
      const originalIntersectionObserver = (window as typeof window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
      delete (window as typeof window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;

      // data-src 속성을 가진 이미지 요소 생성
      const img = document.createElement('img');
      img.setAttribute('data-src', 'test.jpg');
      document.body.appendChild(img);
      const originalSrc = img.src;

      // 에러 없이 실행되어야 함
      expect(() => lazyLoadImages()).not.toThrow();
      
      // 이미지 src가 변경되지 않아야 함
      expect(img.src).toBe(originalSrc);

      // IntersectionObserver 복원
      (window as typeof window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver = originalIntersectionObserver;
    });
  });

  describe('deferExecution', () => {
    it('지연 실행이 정상적으로 작동한다', async () => {
      const callback = vi.fn();
      const delay = 100;

      deferExecution(callback, delay);

      // 즉시 실행되지 않음
      expect(callback).not.toHaveBeenCalled();

      // setTimeout이 호출되었는지 확인
      await new Promise(resolve => setTimeout(resolve, delay + 10));
      expect(callback).toHaveBeenCalledOnce();
    });

    it('requestIdleCallback이 없는 환경에서도 동작한다', async () => {
      // requestIdleCallback을 undefined로 설정
      const originalRequestIdleCallback = window.requestIdleCallback;
      // @ts-expect-error - Testing undefined case
      window.requestIdleCallback = undefined;

      const callback = vi.fn();
      const delay = 50;

      deferExecution(callback, delay);

      await new Promise(resolve => setTimeout(resolve, delay + 10));
      expect(callback).toHaveBeenCalledOnce();

      // 복원
      window.requestIdleCallback = originalRequestIdleCallback;
    });
  });

  describe('EventManager', () => {
    let eventManager: EventManager;
    let mockElement: HTMLElement;

    beforeEach(() => {
      eventManager = new EventManager();
      mockElement = document.createElement('div');
    });

    it('이벤트 리스너를 추가할 수 있다', () => {
      const handler = vi.fn();
      const spy = vi.spyOn(mockElement, 'addEventListener');

      eventManager.addEventListener(mockElement, 'click', handler);

      expect(spy).toHaveBeenCalledWith('click', handler);
    });

    it('모든 이벤트 리스너를 제거할 수 있다', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');

      eventManager.addEventListener(mockElement, 'click', handler1);
      eventManager.addEventListener(mockElement, 'scroll', handler2);

      eventManager.removeAllListeners();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', handler2);
    });
  });

  describe('memoize', () => {
    it('함수 결과를 캐시한다', () => {
      let callCount = 0;
      const expensiveFunction = vi.fn((x: number) => {
        callCount++;
        return x * 2;
      });

      const memoizedFn = memoize(expensiveFunction);

      // 첫 번째 호출
      const result1 = memoizedFn(5);
      expect(result1).toBe(10);
      expect(callCount).toBe(1);

      // 같은 인자로 두 번째 호출 - 캐시된 결과 반환
      const result2 = memoizedFn(5);
      expect(result2).toBe(10);
      expect(callCount).toBe(1); // 함수가 다시 호출되지 않음

      // 다른 인자로 호출
      const result3 = memoizedFn(10);
      expect(result3).toBe(20);
      expect(callCount).toBe(2);
    });

    it('캐시 크기를 제한한다', () => {
      let callCount = 0;
      const fn = vi.fn((x: number) => {
        callCount++;
        return x;
      });

      const memoizedFn = memoize(fn, 2); // 최대 2개 캐시

      // 3개의 서로 다른 인자로 호출
      memoizedFn(1); // callCount = 1, cache: {1}
      memoizedFn(2); // callCount = 2, cache: {1, 2}
      memoizedFn(3); // callCount = 3, cache: {2, 3} (1이 제거됨)

      expect(callCount).toBe(3);

      // 첫 번째 인자는 캐시에서 제거되어 다시 계산됨
      memoizedFn(1); // callCount = 4, cache: {3, 1} (2가 제거됨)
      expect(callCount).toBe(4);

      // 두 번째 인자는 캐시에서 제거되어 다시 계산됨
      memoizedFn(2); // callCount = 5, cache: {1, 2} (3이 제거됨)
      expect(callCount).toBe(5);
      
      // 세 번째 인자는 캐시에서 제거되어 다시 계산됨
      memoizedFn(3); // callCount = 6, cache: {2, 3} (1이 제거됨)
      expect(callCount).toBe(6);
    });
  });

  describe('BatchQueue', () => {
    it('배치 단위로 아이템을 처리한다', async () => {
      const processFn = vi.fn(async (items: number[]) => {
        // 처리 함수 모킹
        return items.length;
      });

      const batchQueue = new BatchQueue(2, 10, processFn);

      // 아이템들이 개별적으로 추가되면서 즉시 처리됨
      batchQueue.add(1);
      batchQueue.add(2);
      batchQueue.add(3);

      // 비동기 처리를 위한 충분한 대기 시간
      await new Promise(resolve => setTimeout(resolve, 100));

      // 모든 아이템이 배치로 처리되었는지 확인
      expect(processFn).toHaveBeenCalled();
      
      // 실제 호출된 인자들을 확인
      const calls = processFn.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      // 모든 아이템이 처리되었는지 확인
      const allProcessedItems = calls.flat().flat();
      expect(allProcessedItems).toContain(1);
      expect(allProcessedItems).toContain(2);
      expect(allProcessedItems).toContain(3);
    });
  });

  describe('calculateVisibleItems', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const itemHeight = 50;
    const containerHeight = 300;

    it('보이는 아이템을 정확히 계산한다', () => {
      const scrollTop = 250; // 5번째 아이템 위치

      const result = calculateVisibleItems(
        items,
        containerHeight,
        itemHeight,
        scrollTop
      );

      // 버퍼 5개를 고려하여 startIndex는 0 (5 - 5 = 0)
      expect(result.startIndex).toBe(0);
      // endIndex는 17 (Math.ceil((250 + 300) / 50) + 5 = 16 + 5)
      expect(result.endIndex).toBe(16);
      expect(result.visibleItems).toHaveLength(16);
      expect(result.totalHeight).toBe(5000); // 100 * 50
    });

    it('스크롤 위치가 0일 때 정상 작동한다', () => {
      const scrollTop = 0;

      const result = calculateVisibleItems(
        items,
        containerHeight,
        itemHeight,
        scrollTop
      );

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(11); // Math.ceil(300/50) + 5 = 6 + 5
      expect(result.visibleItems).toHaveLength(11);
    });

    it('스크롤이 끝에 있을 때 배열 범위를 초과하지 않는다', () => {
      const scrollTop = 4500; // 거의 끝

      const result = calculateVisibleItems(
        items,
        containerHeight,
        itemHeight,
        scrollTop
      );

      expect(result.endIndex).toBeLessThanOrEqual(items.length);
      expect(result.visibleItems.length).toBeGreaterThan(0);
    });

    it('빈 배열을 처리할 수 있다', () => {
      const result = calculateVisibleItems(
        [],
        containerHeight,
        itemHeight,
        0
      );

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(0);
      expect(result.visibleItems).toHaveLength(0);
      expect(result.totalHeight).toBe(0);
    });
  });
});