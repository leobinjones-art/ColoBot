<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="bookmarks" title="书签" icon="🔖"
  columns={[{key:'title',label:'标题'},{key:'url',label:'URL'},{key:'tags',label:'标签'}]}
  formFields={[{key:'title',label:'标题'},{key:'url',label:'URL'},{key:'summary',label:'摘要',type:'textarea'},{key:'tags',label:'标签'}]} />
