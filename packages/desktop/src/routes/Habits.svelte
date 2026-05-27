<script lang="ts">
  import AssistantCRUD from '../components/AssistantCRUD.svelte'
</script>
<AssistantCRUD endpoint="habits" title="习惯" icon="✅"
  columns={[{key:'name',label:'习惯'},{key:'frequency',label:'频率'},{key:'streak',label:'连续'}]}
  formFields={[{key:'name',label:'习惯名'},{key:'frequency',label:'频率'}]} />
