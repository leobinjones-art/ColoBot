<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="timelogs" title="时间追踪" icon="⏱"
  columns={[{key:'activity',label:'活动'},{key:'category',label:'分类'},{key:'duration',label:'时长(分)',type:'number'},{key:'startedAt',label:'开始',type:'date'}]}
  formFields={[{key:'activity',label:'活动'},{key:'category',label:'分类'},{key:'note',label:'备注',type:'textarea'}]} />
