<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="health" title="健康" icon="❤️"
  columns={[{key:'type',label:'类型'},{key:'value',label:'数值'},{key:'unit',label:'单位'},{key:'loggedAt',label:'时间',type:'date'}]}
  formFields={[{key:'type',label:'类型(exercise/sleep/weight/water)'},{key:'value',label:'数值',type:'number'},{key:'unit',label:'单位'},{key:'note',label:'备注',type:'textarea'}]} />
