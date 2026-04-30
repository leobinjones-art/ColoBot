/**
 * 状态同步测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { StateStore, StateUpdater, resetStateStore } from '../state.js'

describe('State', () => {
  let store: StateStore

  beforeEach(() => {
    store = resetStateStore()
  })

  describe('StateStore', () => {
    it('should update and get state', () => {
      store.update('session-1', {
        agentId: 'agent-1',
        lastUserMessage: 'Hello',
        status: 'processing',
      })

      const state = store.get('session-1')
      expect(state).toBeDefined()
      expect(state?.lastUserMessage).toBe('Hello')
      expect(state?.status).toBe('processing')
    })

    it('should delete state', () => {
      store.update('session-1', { agentId: 'agent-1' })
      store.delete('session-1')

      expect(store.get('session-1')).toBeUndefined()
    })

    it('should get states by agent', () => {
      store.update('session-1', { agentId: 'agent-1', status: 'idle' })
      store.update('session-2', { agentId: 'agent-1', status: 'processing' })
      store.update('session-3', { agentId: 'agent-2', status: 'idle' })

      const agent1States = store.getByAgent('agent-1')
      expect(agent1States).toHaveLength(2)
    })

    it('should track progress', () => {
      store.update('session-1', {
        agentId: 'agent-1',
        currentTask: 'Searching...',
        taskProgress: 50,
      })

      const state = store.get('session-1')
      expect(state?.taskProgress).toBe(50)
    })
  })

  describe('StateUpdater', () => {
    let updater: StateUpdater

    beforeEach(() => {
      updater = new StateUpdater(store, 'agent-1')
    })

    it('should track processing lifecycle', () => {
      updater.startProcessing('session-1', 'Hello')

      let state = store.get('session-1')
      expect(state?.status).toBe('processing')

      updater.updateProgress('session-1', 'Searching...', 30)
      state = store.get('session-1')
      expect(state?.taskProgress).toBe(30)

      updater.finishProcessing('session-1', 'Done!')
      state = store.get('session-1')
      expect(state?.status).toBe('idle')
      expect(state?.lastParentResponse).toBe('Done!')
    })

    it('should handle errors', () => {
      updater.startProcessing('session-1', 'Hello')
      updater.handleError('session-1')

      const state = store.get('session-1')
      expect(state?.status).toBe('error')
    })

    it('should save checkpoints', () => {
      updater.startProcessing('session-1', 'Hello')
      updater.saveCheckpoint('session-1', 3, 'Completed search step')

      const state = store.get('session-1')
      expect(state?.lastCheckpoint?.round).toBe(3)
      expect(state?.lastCheckpoint?.summary).toBe('Completed search step')
    })
  })
})
