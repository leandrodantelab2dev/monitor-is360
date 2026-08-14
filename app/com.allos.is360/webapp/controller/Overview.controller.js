sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel", "sap/m/MessageToast"], function (BaseController, JSONModel, MessageToast) {
	"use strict";

	return BaseController.extend("com.allos.is360.controller.Overview", {

		onInit: function () {
			this.setModel(new JSONModel({ total: 0, avgScore: "0.0", verde: 0, amarelo: 0, vermelho: 0 }), "stats");
			this.getRouter().getRoute("overview").attachPatternMatched(this._loadStats, this);
		},

		onViewIflows: function () {
			this.navTo("iflows");
		},

		onSync: function () {
			this._callAction("/syncInventory(...)", {}, oResult => {
				MessageToast.show(this.getResourceBundle().getText("msgSyncSuccess", [oResult.packages, oResult.iflows]));
			});
		},

		onAnalyzeAll: function () {
			this._callAction("/analyzeAll(...)", {}, oResult => {
				MessageToast.show(this.getResourceBundle().getText("msgAnalyzeAllSuccess", [oResult.analisados, oResult.falhas]));
			});
		},

		_callAction: function (sPath, mParameters, fnOnSuccess) {
			this.getView().setBusy(true);
			const oOperation = this.getModel().bindContext(sPath, undefined, { $$updateGroupId: "$auto" });
			Object.keys(mParameters).forEach(sKey => oOperation.setParameter(sKey, mParameters[sKey]));
			oOperation.execute()
				.then(() => {
					this.getView().setBusy(false);
					fnOnSuccess(oOperation.getBoundContext().getObject());
					this._loadStats();
				})
				.catch(oError => {
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("msgError", [oError.message]));
				});
		},

		_loadStats: function () {
			const oBinding = this.getModel().bindList("/Iflows");
			oBinding.requestContexts(0, 1000).then(aContexts => {
				const aData = aContexts.map(oContext => oContext.getObject());
				const aAnalyzed = aData.filter(oIflow => oIflow.band);
				const oCounts = { verde: 0, amarelo: 0, vermelho: 0 };
				aAnalyzed.forEach(oIflow => { if (oCounts[oIflow.band] !== undefined) oCounts[oIflow.band]++; });
				const fAvg = aAnalyzed.length
					? aAnalyzed.reduce((fSum, oIflow) => fSum + (oIflow.score || 0), 0) / aAnalyzed.length
					: 0;
				this.getModel("stats").setData({
					total: aData.length,
					avgScore: fAvg.toFixed(1),
					...oCounts
				});
			});
		}
	});
});
