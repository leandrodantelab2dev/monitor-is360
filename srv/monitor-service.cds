using { is360 } from '../db/schema';

service MonitorService @(path: '/odata/v4/monitor') {

  @readonly entity Packages    as projection on is360.Package;
  @readonly entity Iflows      as projection on is360.Iflow;
  @readonly entity RuleResults as projection on is360.RuleResult;

  action syncInventory() returns { packages: Integer; iflows: Integer };
  action analyzeIflow(ID: String) returns Iflows;
  action analyzeAll() returns { analisados: Integer; falhas: Integer };
}
