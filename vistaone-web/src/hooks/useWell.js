import { useState, useCallback } from "react";
import * as wellService from "../services/wellService";

export function useWell() {
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWells = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await wellService.getWells();
      setWells(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWell = useCallback(async (wellData) => {
    setLoading(true);
    setError(null);
    try {
      const newWell = await wellService.createWell(wellData);
      setWells((prev) => [...prev, newWell]);
      return newWell;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWell = useCallback(async (wellId, wellData) => {
    setLoading(true);
    setError(null);
    try {
      const updatedWell = await wellService.updateWell(wellId, wellData);
      setWells((prev) => prev.map((w) => (w.id === wellId ? updatedWell : w)));
      return updatedWell;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeWell = useCallback(async (wellId) => {
    setLoading(true);
    setError(null);
    try {
      await wellService.deleteWell(wellId);
      setWells((prev) => prev.filter((w) => w.id !== wellId));
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    wells,
    loading,
    error,
    fetchWells,
    createWell,
    updateWell,
    removeWell,
  };
}
