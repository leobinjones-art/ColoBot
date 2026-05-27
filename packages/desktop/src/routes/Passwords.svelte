<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="passwords" title="密码" icon="🔑"
  columns={[{key:'name',label:'名称'},{key:'username',label:'用户名'},{key:'url',label:'URL'},{key:'updatedAt',label:'更新',type:'date'}]}
  formFields={[{key:'name',label:'名称'},{key:'username',label:'用户名'},{key:'password',label:'密码'},{key:'url',label:'URL'},{key:'note',label:'备注',type:'textarea'}]} />
