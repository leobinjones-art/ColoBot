<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="finances" title="财务" icon="💰"
  columns={[{key:'type',label:'类型'},{key:'amount',label:'金额',type:'number'},{key:'category',label:'分类'},{key:'loggedAt',label:'时间',type:'date'}]}
  formFields={[{key:'type',label:'类型(income/expense)'},{key:'amount',label:'金额',type:'number'},{key:'category',label:'分类'},{key:'note',label:'备注',type:'textarea'}]} />
