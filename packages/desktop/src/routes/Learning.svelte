<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="courses" title="学习" icon="🎓"
  columns={[{key:'name',label:'课程'},{key:'totalHours',label:'总时长'},{key:'completedHours',label:'已完成'},{key:'status',label:'状态'}]}
  formFields={[{key:'name',label:'课程名'},{key:'totalHours',label:'总时长',type:'number'}]} />
