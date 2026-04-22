import { useState, useCallback } from "react";
import { invoiceService } from "../services/invoiceService";

export const useInvoice = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch all invoices
    const fetchInvoices = useCallback(async (params = {}) => {
        setLoading(true);
        const data = await invoiceService.getAll(params);
        setInvoices(data);
        setLoading(false);
    }, []);

    // Create a new invoice
    const createInvoice = useCallback(async (payload) => {
        setLoading(true);
        const newInvoice = await invoiceService.create(payload);
        setInvoices((prev) => [newInvoice, ...prev]);
        setLoading(false);
        return newInvoice;
    }, []);

    // Approve an invoice
    const approveInvoice = useCallback(async (invoiceId) => {
        const updated = await invoiceService.approve(invoiceId);
        setInvoices((prev) =>
            prev.map((inv) => (inv.id === invoiceId ? updated : inv))
        );
        return updated;
    }, []);

    // Reject an invoice
    const rejectInvoice = useCallback(async (invoiceId) => {
        const updated = await invoiceService.reject(invoiceId);
        setInvoices((prev) =>
            prev.map((inv) => (inv.id === invoiceId ? updated : inv))
        );
        return updated;
    }, []);

    return {
        invoices,
        loading,
        fetchInvoices,
        createInvoice,
        approveInvoice,
        rejectInvoice,
    };
};
