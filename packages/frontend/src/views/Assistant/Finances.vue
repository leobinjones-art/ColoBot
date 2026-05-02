<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('finance.title') }}</h1>
        <p class="cb-page-desc">追踪收支情况</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary income" @click="showAddIncome = true">
          + {{ t('finance.income') }}
        </button>
        <button class="btn-secondary expense" @click="showAddExpense = true">
          - {{ t('finance.expense') }}
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="cb-card stat-card income">
        <div class="stat-label">{{ t('finance.income') }}</div>
        <div class="stat-value">¥{{ stats.totalIncome?.toFixed(2) || '0.00' }}</div>
      </div>
      <div class="cb-card stat-card expense">
        <div class="stat-label">{{ t('finance.expense') }}</div>
        <div class="stat-value">¥{{ stats.totalExpense?.toFixed(2) || '0.00' }}</div>
      </div>
      <div class="cb-card stat-card balance">
        <div class="stat-label">结余</div>
        <div class="stat-value">¥{{ (stats.totalIncome - stats.totalExpense)?.toFixed(2) || '0.00' }}</div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="records-section">
      <h3>最近记录</h3>
      <div class="record-list">
        <div v-for="record in records" :key="record.id" class="record-item cb-card">
          <div class="record-icon" :class="record.type">
            {{ record.type === 'income' ? '📈' : '📉' }}
          </div>
          <div class="record-info">
            <div class="record-category">{{ record.category || '其他' }}</div>
            <div class="record-note" v-if="record.note">{{ record.note }}</div>
            <div class="record-date">{{ formatDate(record.loggedAt) }}</div>
          </div>
          <div class="record-amount" :class="record.type">
            {{ record.type === 'income' ? '+' : '-' }}¥{{ record.amount?.toFixed(2) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { financeApi } from '@/api'
import type { Finance } from '@/types'

const { t } = useI18n()

const records = ref<Finance[]>([])
const stats = ref({ totalIncome: 0, totalExpense: 0 })
const showAddIncome = ref(false)
const showAddExpense = ref(false)

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

async function fetchRecords() {
  try {
    const res: any = await financeApi.list({})
    records.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch records', e)
  }
}

async function fetchStats() {
  try {
    const res: any = await financeApi.stats()
    stats.value = res.data || { totalIncome: 0, totalExpense: 0 }
  } catch (e) {
    console.error('Failed to fetch stats', e)
  }
}

onMounted(() => {
  fetchRecords()
  fetchStats()
})
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary.income {
  color: var(--cb-success);
  border-color: var(--cb-success);
}

.btn-secondary.expense {
  color: var(--cb-danger);
  border-color: var(--cb-danger);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  text-align: center;
}

.stat-label {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: var(--cb-text-xl);
  font-weight: 600;
}

.stat-card.income .stat-value {
  color: var(--cb-success);
}

.stat-card.expense .stat-value {
  color: var(--cb-danger);
}

.records-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

.record-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: var(--cb-radius-md);
}

.record-icon.income {
  background: rgba(90, 138, 90, 0.1);
}

.record-icon.expense {
  background: rgba(192, 57, 43, 0.1);
}

.record-info {
  flex: 1;
}

.record-category {
  font-weight: 500;
  color: var(--cb-text-primary);
}

.record-note {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.record-date {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.record-amount {
  font-weight: 600;
  font-size: var(--cb-text-lg);
}

.record-amount.income {
  color: var(--cb-success);
}

.record-amount.expense {
  color: var(--cb-danger);
}
</style>