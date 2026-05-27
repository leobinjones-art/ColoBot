<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="goals" title="目标" icon="🎯"
  columns={[{key:'title',label:'目标'},{key:'progress',label:'进度',type:'number'},{key:'status',label:'状态'},{key:'targetDate',label:'截止',type:'date'}]}
  formFields={[{key:'title',label:'目标'},{key:'description',label:'描述',type:'textarea'},{key:'targetDate',label:'截止日期',type:'date'}]} />
