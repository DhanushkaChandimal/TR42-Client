import { useState, useCallback } from "react";
import { workOrderService } from "../services/workOrderService";

export const useWorkOrder = () => {
    const [workOrders, setWorkOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch all work orders
    const fetchWorkOrders = useCallback(async () => {
        setLoading(true);
        const data = await workOrderService.getAll();
        setWorkOrders(data);
        setLoading(false);
    }, []);

    // Create a new work order
    const createWorkOrder = useCallback(async (payload) => {
        setLoading(true);
        const newOrder = await workOrderService.create(payload);
        setWorkOrders((prev) => [newOrder, ...prev]);
        setLoading(false);
        return newOrder;
    }, []);

    // Update a work order
    const updateWorkOrder = useCallback(async (id, updates) => {
        setLoading(true);
        const updated = await workOrderService.update(id, updates);
        setWorkOrders((prev) => prev.map(w => w.id === id ? updated : w));
        setLoading(false);
        return updated;
    }, []);

    // Remove a work order
    const removeWorkOrder = useCallback(async (id) => {
        setLoading(true);
        await workOrderService.remove(id);
        setWorkOrders((prev) => prev.filter(w => w.id !== id));
        setLoading(false);
    }, []);

    return {
        workOrders,
        loading,
        fetchWorkOrders,
        createWorkOrder,
        updateWorkOrder,
        removeWorkOrder,
    };
}