namespace is360;

using { cuid, managed } from '@sap/cds/common';

entity Package {
  key ID          : String;
      name        : String;
      description : String;
      version     : String;
      tags        : String;
      score       : Decimal(5,2);
      syncedAt    : Timestamp;
      iflows      : Association to many Iflow on iflows.package = $self;
}

entity Iflow {
  key ID          : String;
      package     : Association to Package;
      name        : String;
      description : String;
      version     : String;
      adapters    : String;
      score       : Decimal(5,2);
      band        : String enum { verde; amarelo; vermelho };
      syncedAt    : Timestamp;
      analyzedAt  : Timestamp;
      results     : Association to many RuleResult on results.iflow = $self;
}

entity RuleResult : cuid {
      iflow       : Association to Iflow;
      ruleId      : String;
      categoria   : String;
      severidade  : String;
      passed      : Boolean;
      detalhe     : String;
}
