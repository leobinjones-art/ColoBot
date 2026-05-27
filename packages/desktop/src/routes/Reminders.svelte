<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="reminders" title="提醒" icon="⏰"
  columns={[{key:'title',label:'标题'},{key:'time',label:'时间',type:'date'},{key:'repeat',label:'重复'},{key:'completed',label:'完成',type:'boolean'}]}
  formFields={[{key:'title',label:'标题'},{key:'time',label:'时间',type:'date'},{key:'repeat',label:'重复'},{key:'note',label:'备注',type:'textarea'}]} />
