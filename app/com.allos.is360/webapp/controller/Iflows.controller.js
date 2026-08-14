sap.ui.define(["./BaseController"], function (BaseController) {
	"use strict";

	return BaseController.extend("com.allos.is360.controller.Iflows", {

		onOpenIflow: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			this.navTo("iflowDetail", { iflowId: oContext.getProperty("ID") });
		},

		onRefresh: function () {
			this.byId("iflowsTable").getBinding("items").refresh();
		}
	});
});
