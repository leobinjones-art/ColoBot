<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="readings" title="阅读" icon="📚"
  columns={[{key:'title',label:'书名'},{key:'author',label:'作者'},{key:'status',label:'状态'},{key:'progress',label:'进度',type:'number'}]}
  formFields={[{key:'title',label:'书名'},{key:'author',label:'作者'},{key:'type',label:'类型'},{key:'note',label:'笔记',type:'textarea'}]} />
