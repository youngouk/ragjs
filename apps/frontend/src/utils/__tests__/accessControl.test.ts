/**
 * Access Control utilities 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasAdminAccess, removeAdminAccess, setAdminAccess } from '../accessControl';

describe('Access Control Utils', () => {
  // sessionStorage mock
  const mockSessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // sessionStorage mock 설정
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasAdminAccess', () => {
    it('admin_access_granted 값이 "true"일 때 true를 반환한다', () => {
      mockSessionStorage.getItem.mockReturnValue('true');

      const result = hasAdminAccess();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('admin_access_granted');
      expect(result).toBe(true);
    });

    it('admin_access_granted 값이 "true"가 아닐 때 false를 반환한다', () => {
      mockSessionStorage.getItem.mockReturnValue('false');

      const result = hasAdminAccess();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('admin_access_granted');
      expect(result).toBe(false);
    });

    it('admin_access_granted 값이 null일 때 false를 반환한다', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = hasAdminAccess();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('admin_access_granted');
      expect(result).toBe(false);
    });

    it('admin_access_granted 값이 다른 문자열일 때 false를 반환한다', () => {
      mockSessionStorage.getItem.mockReturnValue('yes');

      const result = hasAdminAccess();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('admin_access_granted');
      expect(result).toBe(false);
    });
  });

  describe('setAdminAccess', () => {
    it('sessionStorage에 admin_access_granted를 "true"로 설정한다', () => {
      setAdminAccess();

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('admin_access_granted', 'true');
    });

    it('여러 번 호출해도 정상적으로 작동한다', () => {
      setAdminAccess();
      setAdminAccess();

      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockSessionStorage.setItem).toHaveBeenNthCalledWith(1, 'admin_access_granted', 'true');
      expect(mockSessionStorage.setItem).toHaveBeenNthCalledWith(2, 'admin_access_granted', 'true');
    });
  });

  describe('removeAdminAccess', () => {
    it('sessionStorage에서 admin_access_granted를 제거한다', () => {
      removeAdminAccess();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('admin_access_granted');
    });

    it('여러 번 호출해도 정상적으로 작동한다', () => {
      removeAdminAccess();
      removeAdminAccess();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockSessionStorage.removeItem).toHaveBeenNthCalledWith(1, 'admin_access_granted');
      expect(mockSessionStorage.removeItem).toHaveBeenNthCalledWith(2, 'admin_access_granted');
    });
  });

  describe('통합 시나리오 테스트', () => {
    it('접근 권한 설정 후 확인이 정상적으로 작동한다', () => {
      // 초기에는 접근 권한이 없음
      mockSessionStorage.getItem.mockReturnValue(null);
      expect(hasAdminAccess()).toBe(false);

      // 접근 권한 설정
      setAdminAccess();

      // 접근 권한이 설정된 후에는 true를 반환
      mockSessionStorage.getItem.mockReturnValue('true');
      expect(hasAdminAccess()).toBe(true);

      // 접근 권한 제거
      removeAdminAccess();

      // 제거 후에는 다시 false를 반환
      mockSessionStorage.getItem.mockReturnValue(null);
      expect(hasAdminAccess()).toBe(false);
    });

    it('브라우저가 sessionStorage를 지원하지 않을 때도 에러가 발생하지 않는다', () => {
      // sessionStorage를 undefined로 설정
      Object.defineProperty(window, 'sessionStorage', {
        value: undefined,
        writable: true
      });

      // 에러 없이 실행되어야 함
      expect(() => hasAdminAccess()).toThrow(); // sessionStorage가 undefined일 때는 에러가 발생함
      expect(() => setAdminAccess()).toThrow();
      expect(() => removeAdminAccess()).toThrow();
    });
  });
});