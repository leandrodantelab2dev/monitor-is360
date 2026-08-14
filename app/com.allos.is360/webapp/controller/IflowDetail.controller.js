sap.ui.define(["./BaseController", "sap/m/MessageToast"], function (BaseController, MessageToast) {
	"use strict";

	return BaseController.extend("com.allos.is360.controller.IflowDetail", {

		onInit: function () {
			this.getRouter().getRoute("iflowDetail").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			this._sIflowId = oEvent.getParameter("arguments").iflowId;
			this._bindIflow();
		},

		_bindIflow: function () {
			this.getView().bindElement({
				path: "/Iflows('" + this._sIflowId.replace(/'/g, "''") + "')",
				parameters: { $expand: "results" }
			});
		},

		onAnalyze: function () {
			this.getView().setBusy(true);
			const oOperation = this.getModel().bindContext("/analyzeIflow(...)");
			oOperation.setParameter("ID", this._sIflowId);
			oOperation.execute()
				.then(() => {
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("msgAnalyzeOneSuccess"));
					this._bindIflow();
				})
				.catch(oError => {
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("msgError", [oError.message]));
				});
		}
	});
});
