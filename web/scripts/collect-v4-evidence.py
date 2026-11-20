from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1]
build=root.parent/'.build-artifacts'
verification=root/'verification';verification.mkdir(exist_ok=True)
for source,name in [
 ('water-v4-check.log','v4-check.txt'),
 ('water-v4-region-tests.log','v4-python-regions.txt'),
 ('water-v4-core-audit.json','v4-core-audit.json'),
 ('water-v4-http-smoke.json','v4-http-smoke.json'),
 ('water-v4-legacy-http-smoke.json','v4-legacy-http-smoke.json')]:
    shutil.copy2(build/source,verification/name)
report={
 'release':'4.0.0','date':'2026-11-17',
 'sourceChecks':{'npmRunCheck':'passed','nodeTests':136,'nodeFailures':0,'pythonRegionTests':2,'frozenFiles':97,'registeredSources':15,'newHttpChecks':19,'retainedHttpSuites':6,'productionDependencyAdvisories':0,'nextVersion':'16.4.6'},
 'data':{'inventoryRecords':20084,'chemistryRecords':1495,'siteGroups':62,'channelAssociatedGroups':60,'unmatchedGroups':2,'channelWays':{'dhaka':2431,'sylhet':293,'dacope':2159},'velocityOnlyPoints':40},
 'browser':{'desktop':[1440,1000],'phone':[390,844],'phoneDocumentWidth':382,'sourceCheckPersisted':True,'measurementSavedAndMapped':True,'caseCreatedUpdatedAndReloaded':True,'sessionExpiryHandled':True,'draftRecovery':True,'phoneFormWidthFixed':True,'regionalEvidenceInspectorCorrected':True},
 'limits':['No field pilot, current drinking-water clearance or measured health impact.','Connectivity is mapped and undirected; flow/transport are unverified.','Source snapshots and entered inputs do not become current official alerts.','Hardware GPS and production signed-in CRUD were not tested in this iteration.'],
 'publication':{'status':'blocked','reason':'Sites project not found for original retained project','originalProjectId':'appgprj_6ad373e1c61c8191b11475dbdde7e0d5','audienceChanged':False,'duplicateSiteCreated':False},
 'freshArchiveCheck':'See adjacent ClimatePlus-Water-Platform-v4-archive-checks.json after archive creation.'}
(verification/'v4-validation-summary.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Source verification evidence collected; private runtime state excluded.')
