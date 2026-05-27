<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="contacts" title="联系人" icon="👤"
  columns={[{key:'name',label:'姓名'},{key:'organization',label:'组织'},{key:'email',label:'邮箱'},{key:'phone',label:'电话'}]}
  formFields={[{key:'name',label:'姓名'},{key:'organization',label:'组织'},{key:'email',label:'邮箱'},{key:'phone',label:'电话'},{key:'note',label:'备注',type:'textarea'}]} />
