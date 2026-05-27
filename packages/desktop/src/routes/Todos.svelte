<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="todos" title="待办事项" icon="📋"
  columns={[{key:'title',label:'标题'},{key:'priority',label:'优先级'},{key:'completed',label:'完成',type:'boolean'},{key:'dueDate',label:'截止',type:'date'}]}
  formFields={[{key:'title',label:'标题'},{key:'priority',label:'优先级',type:'number'},{key:'dueDate',label:'截止日期',type:'date'},{key:'description',label:'描述',type:'textarea'}]} />
