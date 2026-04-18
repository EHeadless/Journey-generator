import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Model,
  ModelInput,
  JourneyPhase,
  DemandSpace,
  Dimension,
  DimensionValue,
  Circumstance,
  MarketingActivation,
  ProductActivation,
  ServiceActivation,
} from './types';

type DeletedItemType = 'phase' | 'demandSpace' | 'dimension' | 'dimensionValue' | 'circumstance';
type DeletedItem = JourneyPhase | DemandSpace | Dimension | DimensionValue | Circumstance;

interface EIStudioState {
  // Current model
  model: Model | null;

  // Loading states
  isGeneratingPhases: boolean;
  isGeneratingDemandSpaces: Record<string, boolean>; // keyed by journeyPhaseId
  isGeneratingDimensions: Record<string, boolean>; // keyed by demandSpaceId
  isGeneratingActivations: Record<string, boolean>; // keyed by demandSpaceId

  // Undo state
  lastDeleted: { type: DeletedItemType; item: DeletedItem } | null;

  // Actions
  createModel: (input: ModelInput) => string;

  // Journey Phase actions
  setJourneyPhases: (phases: Omit<JourneyPhase, 'id' | 'order'>[]) => void;
  updateJourneyPhase: (id: string, updates: Partial<JourneyPhase>) => void;
  deleteJourneyPhase: (id: string) => void;
  addJourneyPhase: () => void;

  // Demand Space actions
  setDemandSpaces: (
    journeyPhaseId: string,
    spaces: { label: string; jobToBeDone: string; description?: string }[]
  ) => void;
  updateDemandSpace: (id: string, updates: Partial<DemandSpace>) => void;
  deleteDemandSpace: (id: string) => void;
  addDemandSpace: (journeyPhaseId: string) => void;

  // Dimension actions
  setDimensions: (
    demandSpaceId: string,
    dimensions: {
      label: string;
      description: string;
      values: { label: string; description: string; impact: string }[]
    }[]
  ) => void;
  updateDimension: (id: string, updates: Partial<Omit<Dimension, 'values'>>) => void;
  deleteDimension: (id: string) => void;
  addDimension: (demandSpaceId: string) => void;
  updateDimensionValue: (id: string, updates: Partial<DimensionValue>) => void;
  deleteDimensionValue: (id: string) => void;
  addDimensionValue: (dimensionId: string) => void;

  // Legacy: Circumstance actions (for backwards compatibility)
  setDemandSpacesWithCircumstances: (
    journeyPhaseId: string,
    spaces: { label: string; jobToBeDone: string; description?: string; circumstances: string[] }[]
  ) => void;
  updateCircumstance: (id: string, updates: Partial<Circumstance>) => void;
  deleteCircumstance: (id: string) => void;
  addCircumstance: (demandSpaceId: string) => void;

  // Activation actions
  setMarketingActivations: (demandSpaceId: string, activations: Omit<MarketingActivation, 'id' | 'demandSpaceId'>[], dimensionValueIds: string[]) => void;
  setProductActivations: (demandSpaceId: string, activations: Omit<ProductActivation, 'id' | 'demandSpaceId'>[], dimensionValueIds: string[]) => void;
  setServiceActivations: (demandSpaceId: string, activations: Omit<ServiceActivation, 'id' | 'demandSpaceId'>[], dimensionValueIds: string[]) => void;
  updateMarketingActivation: (id: string, updates: Partial<MarketingActivation>) => void;
  updateProductActivation: (id: string, updates: Partial<ProductActivation>) => void;
  updateServiceActivation: (id: string, updates: Partial<ServiceActivation>) => void;

  // Loading state actions
  setGeneratingPhases: (loading: boolean) => void;
  setGeneratingDemandSpaces: (journeyPhaseId: string, loading: boolean) => void;
  setGeneratingDimensions: (demandSpaceId: string, loading: boolean) => void;
  setGeneratingActivations: (demandSpaceId: string, loading: boolean) => void;

  // Undo
  undoDelete: () => void;
  clearUndo: () => void;
}

export const useStore = create<EIStudioState>((set, get) => ({
  model: null,
  isGeneratingPhases: false,
  isGeneratingDemandSpaces: {},
  isGeneratingDimensions: {},
  isGeneratingActivations: {},
  lastDeleted: null,

  createModel: (input: ModelInput) => {
    const id = uuidv4();
    set({
      model: {
        id,
        input,
        journeyPhases: [],
        demandSpaces: [],
        dimensions: [],
        circumstances: [],
        marketingActivations: [],
        productActivations: [],
        serviceActivations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return id;
  },

  // Journey Phase actions
  setJourneyPhases: (phases) => {
    const { model } = get();
    if (!model) return;

    const journeyPhases = phases.map((phase, index) => ({
      ...phase,
      id: uuidv4(),
      order: index,
    }));

    set({
      model: {
        ...model,
        journeyPhases,
        updatedAt: new Date(),
      },
    });
  },

  updateJourneyPhase: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        journeyPhases: model.journeyPhases.map((phase) =>
          phase.id === id ? { ...phase, ...updates } : phase
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteJourneyPhase: (id) => {
    const { model } = get();
    if (!model) return;

    const phase = model.journeyPhases.find((p) => p.id === id);
    if (!phase) return;

    // Get demand space IDs to clean up dimensions and activations
    const demandSpaceIds = model.demandSpaces
      .filter((ds) => ds.journeyPhaseId === id)
      .map((ds) => ds.id);

    // Get dimension IDs for these demand spaces
    const dimensionIds = model.dimensions
      .filter((d) => demandSpaceIds.includes(d.demandSpaceId))
      .map((d) => d.id);

    // Get all dimension value IDs
    const dimensionValueIds = model.dimensions
      .filter((d) => demandSpaceIds.includes(d.demandSpaceId))
      .flatMap((d) => d.values.map((v) => v.id));

    set({
      model: {
        ...model,
        journeyPhases: model.journeyPhases.filter((p) => p.id !== id),
        demandSpaces: model.demandSpaces.filter((ds) => ds.journeyPhaseId !== id),
        dimensions: model.dimensions.filter((d) => !demandSpaceIds.includes(d.demandSpaceId)),
        circumstances: model.circumstances.filter((c) => !demandSpaceIds.includes(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        productActivations: model.productActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        serviceActivations: model.serviceActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'phase', item: phase },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === phase.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addJourneyPhase: () => {
    const { model } = get();
    if (!model) return;

    const newPhase: JourneyPhase = {
      id: uuidv4(),
      label: '',
      description: '',
      trigger: '',
      order: model.journeyPhases.length,
    };

    set({
      model: {
        ...model,
        journeyPhases: [...model.journeyPhases, newPhase],
        updatedAt: new Date(),
      },
    });
  },

  // Demand Space actions
  setDemandSpaces: (journeyPhaseId, spaces) => {
    const { model } = get();
    if (!model) return;

    // Remove existing demand spaces for this phase
    const otherDemandSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId !== journeyPhaseId
    );

    // Create new demand spaces
    const newDemandSpaces: DemandSpace[] = spaces.map((space, index) => ({
      id: uuidv4(),
      journeyPhaseId,
      label: space.label,
      jobToBeDone: space.jobToBeDone,
      description: space.description,
      order: index,
    }));

    set({
      model: {
        ...model,
        demandSpaces: [...otherDemandSpaces, ...newDemandSpaces],
        updatedAt: new Date(),
      },
    });
  },

  // Legacy: Demand Space with circumstances (for backwards compatibility)
  setDemandSpacesWithCircumstances: (journeyPhaseId, spaces) => {
    const { model } = get();
    if (!model) return;

    // Remove existing demand spaces and their circumstances for this phase
    const existingDsIds = model.demandSpaces
      .filter((ds) => ds.journeyPhaseId === journeyPhaseId)
      .map((ds) => ds.id);

    const otherDemandSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId !== journeyPhaseId
    );
    const otherCircumstances = model.circumstances.filter(
      (c) => !existingDsIds.includes(c.demandSpaceId)
    );

    // Create new demand spaces and their circumstances
    const newDemandSpaces: DemandSpace[] = [];
    const newCircumstances: Circumstance[] = [];

    spaces.forEach((space, dsIndex) => {
      const dsId = uuidv4();

      newDemandSpaces.push({
        id: dsId,
        journeyPhaseId,
        label: space.label,
        jobToBeDone: space.jobToBeDone,
        description: space.description,
        order: dsIndex,
      });

      space.circumstances.forEach((circLabel, circIndex) => {
        newCircumstances.push({
          id: uuidv4(),
          demandSpaceId: dsId,
          label: circLabel,
          order: circIndex,
        });
      });
    });

    set({
      model: {
        ...model,
        demandSpaces: [...otherDemandSpaces, ...newDemandSpaces],
        circumstances: [...otherCircumstances, ...newCircumstances],
        updatedAt: new Date(),
      },
    });
  },

  updateDemandSpace: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        demandSpaces: model.demandSpaces.map((ds) =>
          ds.id === id ? { ...ds, ...updates } : ds
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteDemandSpace: (id) => {
    const { model } = get();
    if (!model) return;

    const demandSpace = model.demandSpaces.find((ds) => ds.id === id);
    if (!demandSpace) return;

    set({
      model: {
        ...model,
        demandSpaces: model.demandSpaces.filter((ds) => ds.id !== id),
        dimensions: model.dimensions.filter((d) => d.demandSpaceId !== id),
        circumstances: model.circumstances.filter((c) => c.demandSpaceId !== id),
        marketingActivations: model.marketingActivations.filter((a) => a.demandSpaceId !== id),
        productActivations: model.productActivations.filter((a) => a.demandSpaceId !== id),
        serviceActivations: model.serviceActivations.filter((a) => a.demandSpaceId !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'demandSpace', item: demandSpace },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === demandSpace.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addDemandSpace: (journeyPhaseId) => {
    const { model } = get();
    if (!model) return;

    const existingSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId === journeyPhaseId
    );

    const newSpace: DemandSpace = {
      id: uuidv4(),
      journeyPhaseId,
      label: '',
      jobToBeDone: '',
      order: existingSpaces.length,
    };

    set({
      model: {
        ...model,
        demandSpaces: [...model.demandSpaces, newSpace],
        updatedAt: new Date(),
      },
    });
  },

  // Dimension actions
  setDimensions: (demandSpaceId, dimensions) => {
    const { model } = get();
    if (!model) return;

    // Remove existing dimensions for this demand space
    const otherDimensions = model.dimensions.filter(
      (d) => d.demandSpaceId !== demandSpaceId
    );

    // Create new dimensions with their values
    const newDimensions: Dimension[] = dimensions.map((dim, dimIndex) => {
      const dimId = uuidv4();
      return {
        id: dimId,
        demandSpaceId,
        label: dim.label,
        description: dim.description,
        order: dimIndex,
        values: dim.values.map((val, valIndex) => ({
          id: uuidv4(),
          dimensionId: dimId,
          label: val.label,
          description: val.description,
          impact: val.impact,
          order: valIndex,
        })),
      };
    });

    set({
      model: {
        ...model,
        dimensions: [...otherDimensions, ...newDimensions],
        updatedAt: new Date(),
      },
    });
  },

  updateDimension: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        dimensions: model.dimensions.map((d) =>
          d.id === id ? { ...d, ...updates } : d
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteDimension: (id) => {
    const { model } = get();
    if (!model) return;

    const dimension = model.dimensions.find((d) => d.id === id);
    if (!dimension) return;

    // Get dimension value IDs to clean up activations
    const valueIds = dimension.values.map((v) => v.id);

    set({
      model: {
        ...model,
        dimensions: model.dimensions.filter((d) => d.id !== id),
        marketingActivations: model.marketingActivations.filter((a) => !valueIds.includes(a.dimensionValueId)),
        productActivations: model.productActivations.filter((a) => !valueIds.includes(a.dimensionValueId)),
        serviceActivations: model.serviceActivations.filter((a) => !valueIds.includes(a.dimensionValueId)),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'dimension', item: dimension },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === dimension.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addDimension: (demandSpaceId) => {
    const { model } = get();
    if (!model) return;

    const existingDimensions = model.dimensions.filter(
      (d) => d.demandSpaceId === demandSpaceId
    );

    const newDimension: Dimension = {
      id: uuidv4(),
      demandSpaceId,
      label: '',
      description: '',
      values: [],
      order: existingDimensions.length,
    };

    set({
      model: {
        ...model,
        dimensions: [...model.dimensions, newDimension],
        updatedAt: new Date(),
      },
    });
  },

  updateDimensionValue: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        dimensions: model.dimensions.map((d) => ({
          ...d,
          values: d.values.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        })),
        updatedAt: new Date(),
      },
    });
  },

  deleteDimensionValue: (id) => {
    const { model } = get();
    if (!model) return;

    let deletedValue: DimensionValue | undefined;

    const updatedDimensions = model.dimensions.map((d) => {
      const value = d.values.find((v) => v.id === id);
      if (value) {
        deletedValue = value;
        return {
          ...d,
          values: d.values.filter((v) => v.id !== id),
        };
      }
      return d;
    });

    if (!deletedValue) return;

    set({
      model: {
        ...model,
        dimensions: updatedDimensions,
        marketingActivations: model.marketingActivations.filter((a) => a.dimensionValueId !== id),
        productActivations: model.productActivations.filter((a) => a.dimensionValueId !== id),
        serviceActivations: model.serviceActivations.filter((a) => a.dimensionValueId !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'dimensionValue', item: deletedValue },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === deletedValue!.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addDimensionValue: (dimensionId) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        dimensions: model.dimensions.map((d) => {
          if (d.id === dimensionId) {
            const newValue: DimensionValue = {
              id: uuidv4(),
              dimensionId,
              label: '',
              description: '',
              impact: '',
              order: d.values.length,
            };
            return {
              ...d,
              values: [...d.values, newValue],
            };
          }
          return d;
        }),
        updatedAt: new Date(),
      },
    });
  },

  // Legacy Circumstance actions
  updateCircumstance: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        circumstances: model.circumstances.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteCircumstance: (id) => {
    const { model } = get();
    if (!model) return;

    const circumstance = model.circumstances.find((c) => c.id === id);
    if (!circumstance) return;

    set({
      model: {
        ...model,
        circumstances: model.circumstances.filter((c) => c.id !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'circumstance', item: circumstance },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === circumstance.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addCircumstance: (demandSpaceId) => {
    const { model } = get();
    if (!model) return;

    const existingCircumstances = model.circumstances.filter(
      (c) => c.demandSpaceId === demandSpaceId
    );

    const newCircumstance: Circumstance = {
      id: uuidv4(),
      demandSpaceId,
      label: '',
      order: existingCircumstances.length,
    };

    set({
      model: {
        ...model,
        circumstances: [...model.circumstances, newCircumstance],
        updatedAt: new Date(),
      },
    });
  },

  // Activation actions (now using dimensionValueId)
  setMarketingActivations: (demandSpaceId, activations, dimensionValueIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.marketingActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      dimensionValueId: dimensionValueIds[index],
    }));

    set({
      model: {
        ...model,
        marketingActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  setProductActivations: (demandSpaceId, activations, dimensionValueIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.productActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      dimensionValueId: dimensionValueIds[index],
    }));

    set({
      model: {
        ...model,
        productActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  setServiceActivations: (demandSpaceId, activations, dimensionValueIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.serviceActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      dimensionValueId: dimensionValueIds[index],
    }));

    set({
      model: {
        ...model,
        serviceActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  updateMarketingActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        marketingActivations: model.marketingActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  updateProductActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        productActivations: model.productActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  updateServiceActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        serviceActivations: model.serviceActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  // Loading state actions
  setGeneratingPhases: (loading) => {
    set({ isGeneratingPhases: loading });
  },

  setGeneratingDemandSpaces: (journeyPhaseId, loading) => {
    set((state) => ({
      isGeneratingDemandSpaces: {
        ...state.isGeneratingDemandSpaces,
        [journeyPhaseId]: loading,
      },
    }));
  },

  setGeneratingDimensions: (demandSpaceId, loading) => {
    set((state) => ({
      isGeneratingDimensions: {
        ...state.isGeneratingDimensions,
        [demandSpaceId]: loading,
      },
    }));
  },

  setGeneratingActivations: (demandSpaceId, loading) => {
    set((state) => ({
      isGeneratingActivations: {
        ...state.isGeneratingActivations,
        [demandSpaceId]: loading,
      },
    }));
  },

  // Undo
  undoDelete: () => {
    const { model, lastDeleted } = get();
    if (!model || !lastDeleted) return;

    switch (lastDeleted.type) {
      case 'phase': {
        const phase = lastDeleted.item as JourneyPhase;
        set({
          model: {
            ...model,
            journeyPhases: [...model.journeyPhases, phase].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'demandSpace': {
        const demandSpace = lastDeleted.item as DemandSpace;
        set({
          model: {
            ...model,
            demandSpaces: [...model.demandSpaces, demandSpace].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'dimension': {
        const dimension = lastDeleted.item as Dimension;
        set({
          model: {
            ...model,
            dimensions: [...model.dimensions, dimension].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'dimensionValue': {
        const value = lastDeleted.item as DimensionValue;
        set({
          model: {
            ...model,
            dimensions: model.dimensions.map((d) => {
              if (d.id === value.dimensionId) {
                return {
                  ...d,
                  values: [...d.values, value].sort((a, b) => a.order - b.order),
                };
              }
              return d;
            }),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'circumstance': {
        const circumstance = lastDeleted.item as Circumstance;
        set({
          model: {
            ...model,
            circumstances: [...model.circumstances, circumstance].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
    }
  },

  clearUndo: () => {
    set({ lastDeleted: null });
  },
}));
