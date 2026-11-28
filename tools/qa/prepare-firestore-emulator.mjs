import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const snippet=readFileSync('docs/firestore-commercial-snippet.rules','utf8');
mkdirSync('.firebase-qa',{recursive:true});
// Synthetic auth allowlist only for emulator. Never deployed.
writeFileSync('.firebase-qa/firestore.rules',"rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\nfunction nexoraLicenseAdmin() { return request.auth != null && request.auth.uid in ['qa-admin-a','qa-admin-b']; }\n"+snippet+"\n}}\n");
writeFileSync('.firebase-qa/firebase.json',JSON.stringify({firestore:{rules:"firestore.rules"},emulators:{firestore:{host:"127.0.0.1",port:8080},ui:{enabled:false},singleProjectMode:true}}));
