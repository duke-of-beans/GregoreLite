/**
 * UI Store Unit Tests
 *
 * Tests UIStore state management without React component interaction.
 * Tests Zustand store directly for predictable state changes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/lib/stores/ui-store';

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useUIStore.getState().resetUI();
  });

  // =========================================================================
  // SIDEBAR TESTS
  // =========================================================================

  describe('Sidebar', () => {
    it('should toggle sidebar open/closed', () => {
      const initialOpen = useUIStore.getState().sidebar.open;
      useUIStore.getState().toggleSidebar();

      expect(useUIStore.getState().sidebar.open).toBe(!initialOpen);
    });

    it('should set sidebar width with clamping', () => {
      // Test normal width
      useUIStore.getState().setSidebarWidth(300);
      expect(useUIStore.getState().sidebar.width).toBe(300);

      // Test min clamp (200px minimum)
      useUIStore.getState().setSidebarWidth(100);
      expect(useUIStore.getState().sidebar.width).toBe(200);

      // Test max clamp (600px maximum)
      useUIStore.getState().setSidebarWidth(1000);
      expect(useUIStore.getState().sidebar.width).toBe(600);
    });

    it('should toggle sidebar collapsed state', () => {
      useUIStore.getState().toggleSidebarCollapsed();
      expect(useUIStore.getState().sidebar.collapsed).toBe(true);

      useUIStore.getState().toggleSidebarCollapsed();
      expect(useUIStore.getState().sidebar.collapsed).toBe(false);
    });
  });

  // =========================================================================
  // THEME TESTS
  // =========================================================================

  describe('Theme', () => {
    it('should set theme', () => {
      useUIStore.getState().setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');

      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('should cycle through themes on toggle', () => {
      // Start with system
      useUIStore.getState().setTheme('system');

      // Cycle: system → light
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('light');

      // light → dark
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('dark');

      // dark → system
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('system');
    });
  });

  // =========================================================================
  // MODAL TESTS
  // =========================================================================

  describe('Modal', () => {
    it('should open modal with data', () => {
      const testData = { key: 'value', count: 123 };
      useUIStore.getState().openModal('test-modal', testData);

      const { modal } = useUIStore.getState();
      expect(modal.activeModal).toBe('test-modal');
      expect(modal.modalData).toEqual(testData);
    });

    it('should close modal and clear data', () => {
      useUIStore.getState().openModal('test-modal', { data: 'test' });
      useUIStore.getState().closeModal();

      const { modal } = useUIStore.getState();
      expect(modal.activeModal).toBeNull();
      expect(modal.modalData).toBeNull();
    });

    it('should check if specific modal is open', () => {
      useUIStore.getState().openModal('test-modal');

      expect(useUIStore.getState().isModalOpen('test-modal')).toBe(true);
      expect(useUIStore.getState().isModalOpen('other-modal')).toBe(false);
    });
  });

  // =========================================================================
  // COMMAND PALETTE TESTS
  // =========================================================================

  describe('Command Palette', () => {
    it('should open and close command palette', () => {
      useUIStore.getState().openCommandPalette();
      expect(useUIStore.getState().commandPalette.open).toBe(true);

      useUIStore.getState().closeCommandPalette();
      expect(useUIStore.getState().commandPalette.open).toBe(false);
    });

    it('should toggle command palette', () => {
      useUIStore.getState().toggleCommandPalette();
      expect(useUIStore.getState().commandPalette.open).toBe(true);

      useUIStore.getState().toggleCommandPalette();
      expect(useUIStore.getState().commandPalette.open).toBe(false);
    });

    it('should update command query', () => {
      useUIStore.getState().setCommandQuery('test query');
      expect(useUIStore.getState().commandPalette.query).toBe('test query');
    });

    it('should track recent commands', () => {
      useUIStore.getState().addRecentCommand('command1');
      useUIStore.getState().addRecentCommand('command2');
      useUIStore.getState().addRecentCommand('command3');

      const recent = useUIStore.getState().commandPalette.recentCommands;
      expect(recent).toEqual(['command3', 'command2', 'command1']);
    });

    it('should limit recent commands to 10', () => {
      for (let i = 1; i <= 15; i++) {
        useUIStore.getState().addRecentCommand(`command${i}`);
      }

      const recent = useUIStore.getState().commandPalette.recentCommands;
      expect(recent).toHaveLength(10);
      expect(recent[0]).toBe('command15'); // Most recent first
    });

    it('should move duplicate command to front', () => {
      useUIStore.getState().addRecentCommand('command1');
      useUIStore.getState().addRecentCommand('command2');
      useUIStore.getState().addRecentCommand('command3');
      useUIStore.getState().addRecentCommand('command1'); // Duplicate

      const recent = useUIStore.getState().commandPalette.recentCommands;
      expect(recent[0]).toBe('command1'); // Moved to front
      expect(recent).toHaveLength(3); // No duplicates
    });
  });

  // =========================================================================
  // NOTIFICATION TESTS
  // =========================================================================

  describe('Notifications', () => {
    it('should add notification', () => {
      const notificationId = useUIStore.getState().addNotification({
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
      });

      const notifications = useUIStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.id).toBe(notificationId);
      expect(notifications[0]?.title).toBe('Test Notification');
      expect(notifications[0]?.dismissed).toBe(false);
    });

    it('should dismiss notification', () => {
      const notificationId = useUIStore.getState().addNotification({
        type: 'info',
        title: 'Test',
      });

      useUIStore.getState().dismissNotification(notificationId);

      const notifications = useUIStore.getState().notifications;
      expect(notifications[0]?.dismissed).toBe(true);
    });

    it('should clear all notifications', () => {
      useUIStore.getState().addNotification({ type: 'info', title: 'Test 1' });
      useUIStore.getState().addNotification({ type: 'info', title: 'Test 2' });
      useUIStore.getState().addNotification({ type: 'info', title: 'Test 3' });

      useUIStore.getState().clearNotifications();

      expect(useUIStore.getState().notifications).toHaveLength(0);
    });

    it('should clear only dismissed notifications', () => {
      const id1 = useUIStore
        .getState()
        .addNotification({ type: 'info', title: 'Test 1' });
      const id2 = useUIStore
        .getState()
        .addNotification({ type: 'info', title: 'Test 2' });

      useUIStore.getState().dismissNotification(id1);
      useUIStore.getState().clearDismissedNotifications();

      const notifications = useUIStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.id).toBe(id2);
    });
  });

  // =========================================================================
  // LOADING STATE TESTS
  // =========================================================================

  describe('Loading States', () => {
    it('should set global loading', () => {
      useUIStore.getState().setGlobalLoading(true);
      expect(useUIStore.getState().loading.global).toBe(true);

      useUIStore.getState().setGlobalLoading(false);
      expect(useUIStore.getState().loading.global).toBe(false);
    });

    it('should set area loading', () => {
      useUIStore.getState().setAreaLoading('sidebar', true);
      useUIStore.getState().setAreaLoading('content', true);

      const { loading } = useUIStore.getState();
      expect(loading.areas['sidebar']).toBe(true);
      expect(loading.areas['content']).toBe(true);
    });

    it('should clear area loading', () => {
      useUIStore.getState().setAreaLoading('sidebar', true);
      useUIStore.getState().clearAreaLoading('sidebar');

      const { loading } = useUIStore.getState();
      expect(loading.areas['sidebar']).toBeUndefined();
    });
  });

  // =========================================================================
  // FOCUS MANAGEMENT TESTS
  // =========================================================================

  describe('Focus Management', () => {
    it('should set focused element', () => {
      useUIStore.getState().setFocusedElement('input-1');
      expect(useUIStore.getState().focusedElement).toBe('input-1');
    });

    it('should clear focused element', () => {
      useUIStore.getState().setFocusedElement('input-1');
      useUIStore.getState().setFocusedElement(null);

      expect(useUIStore.getState().focusedElement).toBeNull();
    });
  });

  // =========================================================================
  // RESET TESTS
  // =========================================================================

  describe('Reset', () => {
    it('should reset all UI state', () => {
      // Modify various state
      useUIStore.getState().setSidebarOpen(false);
      useUIStore.getState().setTheme('dark');
      useUIStore.getState().openModal('test');
      useUIStore.getState().addNotification({ type: 'info', title: 'Test' });
      useUIStore.getState().setGlobalLoading(true);
      useUIStore.getState().setFocusedElement('test-element');

      // Reset everything
      useUIStore.getState().resetUI();

      // Verify all back to defaults
      const state = useUIStore.getState();
      expect(state.sidebar.open).toBe(true); // Default
      expect(state.theme).toBe('system'); // Default
      expect(state.modal.activeModal).toBeNull();
      expect(state.notifications).toHaveLength(0);
      expect(state.loading.global).toBe(false);
      expect(state.focusedElement).toBeNull();
    });
  });
});
