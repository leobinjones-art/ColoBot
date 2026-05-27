<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="inspirations" title="灵感" icon="💡"
  columns={[{key:'content',label:'内容'},{key:'tags',label:'标签'},{key:'createdAt',label:'时间',type:'date'}]}
  formFields={[{key:'content',label:'内容',type:'textarea'},{key:'tags',label:'标签'}]} />
