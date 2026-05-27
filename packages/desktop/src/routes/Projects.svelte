<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="projects" title="项目" icon="📁"
  columns={[{key:'name',label:'项目'},{key:'status',label:'状态'},{key:'progress',label:'进度',type:'number'}]}
  formFields={[{key:'name',label:'项目名'},{key:'description',label:'描述',type:'textarea'}]} />
