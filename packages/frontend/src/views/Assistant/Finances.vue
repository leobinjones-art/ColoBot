<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('finance.title') }}</h1>
        <p class="cb-page-desc">追踪收支情况</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary income" @click="openModal('income')">
          + {{ t('finance.income') }}
        </button>
        <button class="btn-secondary expense" @click="openModal('expense')">
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
      <div class="cb-card stat-card balance" :class="{ negative: balance < 0 }">
        <div class="stat-label">结余</div>
        <div class="stat-value">¥{{ balance.toFixed(2) }}</div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <div class="cb-card chart-card">
        <h3>收支趋势</h3>
        <div ref="trendChartRef" class="chart-container"></div>
      </div>
      <div class="cb-card chart-card">
        <h3>支出分类</h3>
        <div ref="pieChartRef" class="chart-container"></div>
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
          <button class="delete-btn" @click="confirmDelete(record)">🗑</button>
        </div>
      </div>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <p>暂无记录，点击上方按钮添加</p>
    </div>

    <!-- 添加记录弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ form.type === 'income' ? '添加收入' : '添加支出' }}</h2>
        <form @submit.prevent="saveRecord">
          <div class="form-group">
            <label>金额</label>
            <input
              v-model.number="form.amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="输入金额"
            />
          </div>
          <div class="form-group">
            <label>分类</label>
            <select v-model="form.category">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>备注</label>
            <input v-model="form.note" type="text" placeholder="输入备注（可选）" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content confirm-modal">
        <h2>{{ t('common.confirmDelete') }}</h2>
        <p>确定要删除这条记录吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-danger" @click="deleteRecord">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { financeApi } from '@/api'
import type { Finance } from '@/types'
import * as echarts from 'echarts'

const { t } = useI18n()

const records = ref<Finance[]>([])
const stats = ref({ totalIncome: 0, totalExpense: 0 })
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingRecord = ref<Finance | null>(null)

const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

const incomeCategories = ['工资', '奖金', '投资', '兼职', '其他收入']
const expenseCategories = [
  '餐饮',
  '交通',
  '购物',
  '娱乐',
  '医疗',
  '教育',
  '房租',
  '水电',
  '其他支出',
]

const form = ref({
  type: 'expense' as 'income' | 'expense',
  amount: 0,
  category: '',
  note: '',
})

const categories = ref<string[]>(expenseCategories)

const balance = computed(() => (stats.value.totalIncome || 0) - (stats.value.totalExpense || 0))

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

function openModal(type: 'income' | 'expense') {
  form.value = { type, amount: 0, category: '', note: '' }
  categories.value = type === 'income' ? incomeCategories : expenseCategories
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function fetchRecords() {
  try {
    const res: any = await financeApi.list({})
    records.value = res.data || []
    updateCharts()
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

function initCharts() {
  nextTick(() => {
    if (trendChartRef.value) {
      trendChart = echarts.init(trendChartRef.value)
    }
    if (pieChartRef.value) {
      pieChart = echarts.init(pieChartRef.value)
    }
    updateCharts()
  })
}

function updateCharts() {
  if (!trendChart || !pieChart) return

  // 趋势图
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  })

  const incomeByDay = last7Days.map(() => Math.random() * 1000)
  const expenseByDay = last7Days.map(() => Math.random() * 500)

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: last7Days },
    yAxis: { type: 'value' },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: incomeByDay,
        itemStyle: { color: '#5a8a5a' },
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: expenseByDay,
        itemStyle: { color: '#c0392b' },
      },
    ],
  })

  // 饼图
  const categoryData = [
    { value: 35.5, name: '餐饮' },
    { value: 20, name: '交通' },
    { value: 50, name: '购物' },
    { value: 30, name: '娱乐' },
  ]

  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: categoryData,
      },
    ],
  })
}

async function saveRecord() {
  try {
    await financeApi.create(form.value)
    closeModal()
    fetchRecords()
    fetchStats()
  } catch (e) {
    console.error('Failed to save record', e)
  }
}

function confirmDelete(record: Finance) {
  deletingRecord.value = record
  showDeleteConfirm.value = true
}

async function deleteRecord() {
  if (!deletingRecord.value) return
  try {
    records.value = records.value.filter((r) => r.id !== deletingRecord.value!.id)
    showDeleteConfirm.value = false
    deletingRecord.value = null
    fetchStats()
    updateCharts()
  } catch (e) {
    console.error('Failed to delete record', e)
  }
}

onMounted(() => {
  fetchRecords()
  fetchStats()
  initCharts()
})

watch(() => [records.value], updateCharts, { deep: true })
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

.stat-card.balance.negative .stat-value {
  color: var(--cb-danger);
}

.charts-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  padding: 16px;
}

.chart-card h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.chart-container {
  height: 250px;
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

.delete-btn {
  padding: 8px;
  background: transparent;
  border: none;
  font-size: 14px;
  cursor: pointer;
}

.delete-btn:hover {
  color: var(--cb-danger);
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-lg);
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

.modal-content h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
}

.confirm-modal {
  max-width: 350px;
}

.confirm-modal p {
  color: var(--cb-text-secondary);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 6px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-secondary {
  padding: 10px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  cursor: pointer;
}

.btn-primary {
  padding: 10px 16px;
  background: var(--cb-primary);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}

.btn-danger {
  padding: 10px 16px;
  background: var(--cb-danger);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}

@media (max-width: 768px) {
  .charts-section {
    grid-template-columns: 1fr;
  }
}
</style>
