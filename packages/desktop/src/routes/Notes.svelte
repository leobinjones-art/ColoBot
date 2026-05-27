<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="notes" title="笔记" icon="📝"
  columns={[{key:'title',label:'标题'},{key:'tags',label:'标签'},{key:'updatedAt',label:'更新',type:'date'}]}
  formFields={[{key:'title',label:'标题'},{key:'tags',label:'标签'},{key:'content',label:'内容',type:'textarea'}]} />
