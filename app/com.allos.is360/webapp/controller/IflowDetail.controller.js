sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/GroupHeaderListItem"
], function (BaseController, JSONModel, MessageToast, GroupHeaderListItem) {
	"use strict";

	return BaseController.extend("com.allos.is360.controller.IflowDetail", {

		onInit: function () {
			this.setModel(new JSONModel({ total: 0, passed: 0, failed: 0 }), "summary");
			this.getRouter().getRoute("iflowDetail").attachPatternMatched(this._onRouteMatched, this);
		},

		createGroupHeader: function (oGroup) {
			return new GroupHeaderListItem({ title: oGroup.key });
		},

		_onRouteMatched: function (oEvent) {
			this._sIflowId = oEvent.getParameter("arguments").iflowId;
			this._bindIflow();
			this._loadSummary();
		},

		_bindIflow: function () {
			this.getView().bindElement({
				path: "/Iflows('" + this._sIflowId.replace(/'/g, "''") + "')",
				parameters: { $expand: "results" }
			});
		},

		_loadSummary: function () {
			const oBinding = this.getModel().bindList(`/Iflows('${this._sIflowId.replace(/'/g, "''")}')/results`);
			oBinding.requestContexts(0, 500).then(aContexts => {
				const aResults = aContexts.map(oContext => oContext.getObject());
				const iPassed = aResults.filter(oResult => oResult.passed).length;
				this.getModel("summary").setData({ total: aResults.length, passed: iPassed, failed: aResults.length - iPassed });
			});
		},

		onAnalyze: function () {
			this.getView().setBusy(true);
			const oOperation = this.getModel().bindContext("/analyzeIflow(...)");
			oOperation.setParameter("ID", this._sIflowId);
			oOperation.execute()
				.then(() => this.getResourceBundle())
				.then(oBundle => {
					this.getView().setBusy(false);
					MessageToast.show(oBundle.getText("msgAnalyzeOneSuccess"));
					this._bindIflow();
					this._loadSummary();
				})
				.catch(oError => Promise.all([oError, this.getResourceBundle()]).then(([oErr, oBundle]) => {
					this.getView().setBusy(false);
					MessageToast.show(oBundle.getText("msgError", [oErr.message]));
				}));
		}
	});
});
