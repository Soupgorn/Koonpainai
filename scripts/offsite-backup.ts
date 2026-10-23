import {offsiteCli} from './portable/offsite';
void offsiteCli().catch(()=>{console.error(JSON.stringify({status:'FAIL',code:'OFFSITE_VERIFICATION_FAILED',productionConnected:false,remotePartialPreserved:true}));process.exitCode=1;});
