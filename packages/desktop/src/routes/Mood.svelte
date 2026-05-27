<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="moods" title="心情" icon="😊"
  columns={[{key:'mood',label:'心情'},{key:'score',label:'分数',type:'number'},{key:'note',label:'备注'},{key:'loggedAt',label:'时间',type:'date'}]}
  formFields={[{key:'mood',label:'心情'},{key:'score',label:'分数(1-10)',type:'number'},{key:'note',label:'备注',type:'textarea'}]} />
