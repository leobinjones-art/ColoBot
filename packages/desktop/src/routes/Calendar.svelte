<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="events" title="日历" icon="📅"
  columns={[{key:'title',label:'事件'},{key:'startTime',label:'开始',type:'date'},{key:'endTime',label:'结束',type:'date'},{key:'location',label:'地点'}]}
  formFields={[{key:'title',label:'事件'},{key:'startTime',label:'开始',type:'date'},{key:'endTime',label:'结束',type:'date'},{key:'location',label:'地点'},{key:'description',label:'描述',type:'textarea'}]} />
