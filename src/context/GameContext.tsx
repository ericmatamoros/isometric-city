// Consolidated GameContext for the SimCity-like game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { SocketContext } from './SocketContext';
import { WalletContext } from './WalletContext';
import {
  Budget,
  BuildingType,
  ActivityLogEntry,
  GameState,
  LeaderboardEntry,
  SavedCityMeta,
  Tool,
  TOOL_INFO,
  ZoneType,
  RobberyEvent,
  FineEvent,
  Loan,
} from '@/types/game';
import {
  bulldozeTile,
  createInitialGameState,
  DEFAULT_GRID_SIZE,
  placeBuilding,
  placeSubway,
  placeWaterTerraform,
  placeLandTerraform,
  simulateTick,
  checkForDiscoverableCities,
  generateRandomAdvancedCity,
  createBridgesOnPath,
  SERVICE_BUILDING_TYPES,
} from '@/lib/simulation';
import {
  SPRITE_PACKS,
  DEFAULT_SPRITE_PACK_ID,
  getSpritePack,
  setActiveSpritePack,
  SpritePack,
} from '@/lib/renderConfig';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITY_STORAGE_KEY = 'isocity-saved-city'; // For restoring after viewing shared city
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index'; // Index of all saved cities
const SAVED_CITY_PREFIX = 'isocity-city-'; // Prefix for individual saved city states
const SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
const DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';

export type DayNightMode = 'auto' | 'day' | 'night';

// Info about a saved city (for restore functionality)
export type SavedCityInfo = {
  cityName: string;
  population: number;
  money: number;
  savedAt: number;
} | null;

type GameContextValue = {
  state: GameState;
  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setTaxRate: (rate: number) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setBudgetFunding: (key: keyof Budget, funding: number) => void;
  placeAtTile: (x: number, y: number) => void;
  finishTrackDrag: (pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail') => void; // Create bridges after road/rail drag
  connectToCity: (cityId: string) => void;
  discoverCity: (cityId: string) => void;
  checkAndDiscoverCities: (onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void) => void;
  setDisastersEnabled: (enabled: boolean) => void;
  newGame: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  generateRandomCity: () => void;
  hasExistingGame: boolean;
  isSaving: boolean;
  addMoney: (amount: number) => void;
  addNotification: (title: string, description: string, icon: string) => void;
  // Sprite pack management
  currentSpritePack: SpritePack;
  availableSpritePacks: SpritePack[];
  setSpritePack: (packId: string) => void;
  // Day/night mode override
  dayNightMode: DayNightMode;
  setDayNightMode: (mode: DayNightMode) => void;
  visualHour: number; // The hour to use for rendering (respects day/night mode override)
  // Save/restore city for shared links
  saveCurrentCityForRestore: () => void;
  restoreSavedCity: () => boolean;
  getSavedCityInfo: () => SavedCityInfo;
  clearSavedCity: () => void;
  // Multi-city save system
  savedCities: SavedCityMeta[];
  saveCity: () => void;
  loadSavedCity: (cityId: string) => boolean;
  deleteSavedCity: (cityId: string) => void;
  renameSavedCity: (cityId: string, newName: string) => void;
  addFloatingText: (x: number, y: number, text: string, color: string) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const toolBuildingMap: Partial<Record<Tool, BuildingType>> = {
  road: 'road',
  rail: 'rail',
  rail_station: 'rail_station',
  tree: 'tree',
  police_station: 'police_station',
  fire_station: 'fire_station',
  hospital: 'hospital',
  school: 'school',
  university: 'university',
  park: 'park',
  park_large: 'park_large',
  tennis: 'tennis',
  power_plant: 'power_plant',
  water_tower: 'water_tower',
  subway_station: 'subway_station',
  stadium: 'stadium',
  museum: 'museum',
  airport: 'airport',
  space_program: 'space_program',
  city_hall: 'city_hall',
  amusement_park: 'amusement_park',
  // New parks
  basketball_courts: 'basketball_courts',
  playground_small: 'playground_small',
  playground_large: 'playground_large',
  baseball_field_small: 'baseball_field_small',
  soccer_field_small: 'soccer_field_small',
  football_field: 'football_field',
  baseball_stadium: 'baseball_stadium',
  community_center: 'community_center',
  office_building_small: 'office_building_small',
  swimming_pool: 'swimming_pool',
  skate_park: 'skate_park',
  mini_golf_course: 'mini_golf_course',
  bleachers_field: 'bleachers_field',
  go_kart_track: 'go_kart_track',
  amphitheater: 'amphitheater',
  greenhouse_garden: 'greenhouse_garden',
  animal_pens_farm: 'animal_pens_farm',
  cabin_house: 'cabin_house',
  campground: 'campground',
  marina_docks_small: 'marina_docks_small',
  pier_large: 'pier_large',
  roller_coaster_small: 'roller_coaster_small',
  community_garden: 'community_garden',
  pond_park: 'pond_park',
  park_gate: 'park_gate',
  mountain_lodge: 'mountain_lodge',
  mountain_trailhead: 'mountain_trailhead',
};

const toolZoneMap: Partial<Record<Tool, ZoneType>> = {
  zone_residential: 'residential',
  zone_commercial: 'commercial',
  zone_industrial: 'industrial',
  zone_dezone: 'none',
};

// Load game state from localStorage
function loadGameState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate it has essential properties
      if (parsed &&
        parsed.grid &&
        Array.isArray(parsed.grid) &&
        parsed.gridSize &&
        typeof parsed.gridSize === 'number' &&
        parsed.stats &&
        parsed.stats.money !== undefined &&
        parsed.stats.population !== undefined) {
        // Migrate park_medium to park_large
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building?.type === 'park_medium') {
                parsed.grid[y][x].building.type = 'park_large';
              }
            }
          }
        }
        // Migrate selectedTool if it's park_medium
        if (parsed.selectedTool === 'park_medium') {
          parsed.selectedTool = 'park_large';
        }
        // Ensure adjacentCities and waterBodies exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          // Create a default city covering the entire map
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure hour exists for day/night cycle
        if (parsed.hour === undefined) {
          parsed.hour = 12; // Default to noon
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9; // Start at current tax rate
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
              // GRANDFATHER: Mark existing service buildings as exempt from road connectivity requirement
              // This ensures saved games continue to work without breaking changes
              if (parsed.grid[y][x]?.building) {
                const buildingType = parsed.grid[y][x].building.type;
                if (SERVICE_BUILDING_TYPES.has(buildingType) &&
                  parsed.grid[y][x].building.grandfatheredRoadAccess === undefined) {
                  parsed.grid[y][x].building.grandfatheredRoadAccess = true;
                }
              }
            }
          }
        }
        // Ensure gameVersion exists for backward compatibility
        if (parsed.gameVersion === undefined) {
          parsed.gameVersion = 0;
        }
        // Migrate to include UUID if missing
        if (!parsed.id) {
          parsed.id = generateUUID();
        }
        return parsed as GameState;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (clearError) {
      console.error('Failed to clear corrupted game state:', clearError);
    }
  }
  return null;
}

// Save game state to localStorage
function saveGameState(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    // Validate state before saving
    if (!state || !state.grid || !state.gridSize || !state.stats) {
      console.error('Invalid game state, cannot save', { state, hasGrid: !!state?.grid, hasGridSize: !!state?.gridSize, hasStats: !!state?.stats });
      return;
    }

    const serialized = JSON.stringify(state);

    // Check if data is too large (localStorage has ~5-10MB limit)
    if (serialized.length > 5 * 1024 * 1024) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    // Handle quota exceeded errors
    if (e instanceof DOMException && (e.code === 22 || e.code === 1014)) {
      console.error('localStorage quota exceeded, cannot save game state');
    } else {
      console.error('Failed to save game state:', e);
    }
  }
}

// Clear saved game state
function clearGameState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear game state:', e);
  }
}

// Load sprite pack from localStorage
function loadSpritePackId(): string {
  if (typeof window === 'undefined') return DEFAULT_SPRITE_PACK_ID;
  try {
    const saved = localStorage.getItem(SPRITE_PACK_STORAGE_KEY);
    if (saved && SPRITE_PACKS.some(p => p.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load sprite pack preference:', e);
  }
  return DEFAULT_SPRITE_PACK_ID;
}

// Save sprite pack to localStorage
function saveSpritePackId(packId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPRITE_PACK_STORAGE_KEY, packId);
  } catch (e) {
    console.error('Failed to save sprite pack preference:', e);
  }
}

// Load day/night mode from localStorage
function loadDayNightMode(): DayNightMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(DAY_NIGHT_MODE_STORAGE_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'night') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load day/night mode preference:', e);
  }
  return 'auto';
}

// Save day/night mode to localStorage
function saveDayNightMode(mode: DayNightMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAY_NIGHT_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.error('Failed to save day/night mode preference:', e);
  }
}

// Save current city for later restoration (when viewing shared cities)
function saveCityForRestore(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    const savedData = {
      state: state,
      info: {
        cityName: state.cityName,
        population: state.stats.population,
        money: state.stats.money,
        savedAt: Date.now(),
      },
    };
    localStorage.setItem(SAVED_CITY_STORAGE_KEY, JSON.stringify(savedData));
  } catch (e) {
    console.error('Failed to save city for restore:', e);
  }
}

// Load saved city info (just metadata, not full state)
function loadSavedCityInfo(): SavedCityInfo {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.info) {
        return parsed.info as SavedCityInfo;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city info:', e);
  }
  return null;
}

// Load full saved city state
function loadSavedCityState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.state && parsed.state.grid && parsed.state.gridSize && parsed.state.stats) {
        return parsed.state as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city state:', e);
  }
  return null;
}

// Clear saved city
function clearSavedCityStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved city:', e);
  }
}

// Generate a UUID v4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Load saved cities index from localStorage
function loadSavedCitiesIndex(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch (e) {
    console.error('Failed to load saved cities index:', e);
  }
  return [];
}

// Save saved cities index to localStorage
function saveSavedCitiesIndex(cities: SavedCityMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(cities));
  } catch (e) {
    console.error('Failed to save cities index:', e);
  }
}

// Save a city state to localStorage
function saveCityState(cityId: string, state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(state);
    // Check if data is too large
    if (serialized.length > 5 * 1024 * 1024) {
      console.error('City state too large to save');
      return;
    }
    localStorage.setItem(SAVED_CITY_PREFIX + cityId, serialized);
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.code === 1014)) {
      console.error('localStorage quota exceeded');
    } else {
      console.error('Failed to save city state:', e);
    }
  }
}

// Load a saved city state from localStorage
function loadCityState(cityId: string): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.grid && parsed.gridSize && parsed.stats) {
        return parsed as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load city state:', e);
  }
  return null;
}

// Delete a saved city from localStorage
function deleteCityState(cityId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_PREFIX + cityId);
  } catch (e) {
    console.error('Failed to delete city state:', e);
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  // Start with a default state, we'll load from localStorage after mount
  const [state, setState] = useState<GameState>(() => createInitialGameState(DEFAULT_GRID_SIZE, 'IsoCity'));

  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Sprite pack state
  const [currentSpritePack, setCurrentSpritePack] = useState<SpritePack>(() => getSpritePack(DEFAULT_SPRITE_PACK_ID));

  // Day/night mode state
  const [dayNightMode, setDayNightModeState] = useState<DayNightMode>('auto');

  // Saved cities state for multi-city save system
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);

  // Load game state and sprite pack from localStorage on mount (client-side only)
  useEffect(() => {
    // Load sprite pack preference
    const savedPackId = loadSpritePackId();
    const pack = getSpritePack(savedPackId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);

    // Load day/night mode preference
    const savedDayNightMode = loadDayNightMode();
    setDayNightModeState(savedDayNightMode);

    // Load saved cities index
    const cities = loadSavedCitiesIndex();
    setSavedCities(cities);

    // Load game state
    const saved = loadGameState();
    if (saved) {
      skipNextSaveRef.current = true; // Set skip flag BEFORE updating state
      setState(saved);
      setHasExistingGame(true);
    } else {
      setHasExistingGame(false);
    }
    // Mark as loaded immediately - the skipNextSaveRef will handle skipping the first save
    hasLoadedRef.current = true;
  }, []);

  // Track the state that needs to be saved
  const stateToSaveRef = useRef<GameState | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update the state to save whenever state changes
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      lastSaveTimeRef.current = Date.now();
      return;
    }

    // Store current state for saving (deep copy)
    stateToSaveRef.current = JSON.parse(JSON.stringify(state));
  }, [state]);

  // Separate effect that actually performs saves on an interval
  useEffect(() => {
    // Wait for initial load
    const checkLoaded = setInterval(() => {
      if (!hasLoadedRef.current) {
        return;
      }

      // Clear the check interval
      clearInterval(checkLoaded);

      // Clear any existing save interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }

      // Set up interval to save every 3 seconds if there's pending state
      saveIntervalRef.current = setInterval(() => {
        // Don't save if we just loaded
        if (skipNextSaveRef.current) {
          return;
        }

        // Don't save too frequently
        const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
        if (timeSinceLastSave < 2000) {
          return;
        }

        // Don't save if there's no state to save
        if (!stateToSaveRef.current) {
          return;
        }

        // Perform the save
        setIsSaving(true);
        try {
          saveGameState(stateToSaveRef.current);
          lastSaveTimeRef.current = Date.now();
          setHasExistingGame(true);
        } finally {
          setIsSaving(false);
        }
      }, 3000); // Check every 3 seconds
    }, 100);

    return () => {
      clearInterval(checkLoaded);
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // Simulation loop - with mobile performance optimization
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    if (state.speed > 0) {
      // Check if running on mobile for performance optimization
      const isMobileDevice = typeof window !== 'undefined' && (
        window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );

      // Slower tick intervals on mobile to reduce CPU load
      // Desktop: 500ms, 220ms, 50ms for speeds 1, 2, 3
      // Mobile: 750ms, 400ms, 150ms for speeds 1, 2, 3 (50% slower)
      const interval = isMobileDevice
        ? (state.speed === 1 ? 750 : state.speed === 2 ? 400 : 150)
        : (state.speed === 1 ? 500 : state.speed === 2 ? 220 : 50);

      timer = setInterval(() => {
        setState((prev) => simulateTick(prev));
      }, interval);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [state.speed]);

  const setTool = useCallback((tool: Tool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setTaxRate = useCallback((rate: number) => {
    setState((prev) => ({ ...prev, taxRate: clamp(rate, 0, 100) }));
  }, []);

  const setActivePanel = useCallback(
    (panel: GameState['activePanel']) => {
      setState((prev) => ({ ...prev, activePanel: panel }));
    },
    [],
  );

  const setBudgetFunding = useCallback(
    (key: keyof Budget, funding: number) => {
      const clamped = clamp(funding, 0, 100);
      setState((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [key]: { ...prev.budget[key], funding: clamped },
        },
      }));
    },
    [],
  );

  const addFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    setState(prev => ({
      ...prev,
      floatingTexts: [
        ...(prev.floatingTexts || []),
        {
          id: Math.random().toString(36).substring(7),
          x,
          y,
          text,
          color,
          opacity: 1,
          life: 1
        }
      ]
    }));
  }, []);

  // Inject Socket and Wallet contexts
  const { socket, isConnected: isSocketConnected } = useContext(SocketContext) || { socket: null, isConnected: false };
  const { address: walletAddress } = useContext(WalletContext) || { address: null };

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('tile_updated', (data: { x: number; y: number; type: string; ownerAddress: string }) => {
      setState((prev) => {
        // Update the grid with the new building
        // We need to map the string type back to BuildingType if needed, or just use it
        // Ideally we should use the placeBuilding function but avoiding side effects
        // For now, let's just force the update on the grid
        const newGrid = [...prev.grid];
        const row = [...newGrid[data.y]];

        // Create a basic building of that type
        // Note: This is a simplification. Ideally we'd use placeBuilding logic
        // but we need to avoid the cost check and just apply the change
        // We also need to handle 'owner' metadata which we haven't added to Building yet

        // For now, just log it
        console.log('Remote tile update:', data);

        // TODO: Implement proper remote placement
        return prev;
      });
    });

    socket.on('tile_for_sale', (data: { x: number; y: number; price: number; ownerAddress: string }) => {
      setState((prev) => {
        const newGrid = [...prev.grid];
        newGrid[data.y] = [...prev.grid[data.y]];
        newGrid[data.y][data.x] = {
          ...newGrid[data.y][data.x],
          building: {
            ...newGrid[data.y][data.x].building,
            forSale: true,
            price: data.price
          }
        };
        return { ...prev, grid: newGrid };
      });
      addNotification('Market', `Property listed at ${data.x},${data.y} for $${data.price}`, 'info');
    });

    socket.on('tile_sold', (data: { x: number; y: number; newOwnerAddress: string; price: number }) => {
      setState((prev) => {
        const newGrid = [...prev.grid];
        newGrid[data.y] = [...prev.grid[data.y]];
        newGrid[data.y][data.x] = {
          ...newGrid[data.y][data.x],
          building: {
            ...newGrid[data.y][data.x].building,
            ownerId: data.newOwnerAddress,
            forSale: false,
            price: undefined
          }
        };
        return { ...prev, grid: newGrid };
      });
      addNotification('Market', `Property at ${data.x},${data.y} sold for $${data.price}`, 'success');
    });

    socket.on('transaction_complete', (data: {
      buyerAddress: string;
      buyerBalance: number;
      sellerAddress: string;
      sellerBalance: number;
      x: number;
      y: number;
      price: number;
    }) => {
      if (walletAddress === data.buyerAddress) {
        setState(prev => ({ ...prev, playerBalance: data.buyerBalance }));
        addNotification('Wallet', `Purchase successful. New balance: $${data.buyerBalance}`, 'success');
        addFloatingText(data.x, data.y, `-$${data.price}`, '#ef4444');
      }
      if (walletAddress === data.sellerAddress) {
        setState(prev => ({ ...prev, playerBalance: data.sellerBalance }));
        addNotification('Wallet', `Sale successful. New balance: $${data.sellerBalance}`, 'success');
        addFloatingText(data.x, data.y, `+$${data.price}`, '#10b981');
      }
    });

    socket.on('activity', (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
      const newEntry: ActivityLogEntry = {
        ...entry,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now()
      };
      setState(prev => ({
        ...prev,
        activityLog: [newEntry, ...(prev.activityLog || [])].slice(0, 50)
      }));
    });

    socket.on('balance_update', (data: number | { balance: number }) => {
      const balance = typeof data === 'number' ? data : data.balance;
      setState(prev => ({ ...prev, playerBalance: balance }));
    });

    socket.on('rent_collected', (data: { x: number; y: number; amount: number; tax?: number }) => {
      const taxMsg = data.tax ? ` (Tax: $${data.tax})` : '';
      addNotification('Income', `Collected $${data.amount} rent from property at ${data.x},${data.y}${taxMsg}`, 'success');
      addFloatingText(data.x, data.y, `+$${data.amount}`, '#10b981');
    });

    socket.on('robbery_event', (data: RobberyEvent) => {
      setState(prev => ({
        ...prev,
        robberyLog: [data, ...(prev.robberyLog || [])].slice(0, 20)
      }));

      if (data.wasProtected) {
        addNotification('Security', `Robbery thwarted at (${data.x}, ${data.y})!`, 'info');
        addFloatingText(data.x, data.y, '🛡️ Thwarted', '#3b82f6');
      } else {
        addNotification('Security', `Robbery! Lost $${data.amount} at (${data.x}, ${data.y})`, 'alert');
        addFloatingText(data.x, data.y, `-$${data.amount} 💰`, '#ef4444');
      }
    });

    socket.on('fine_event', (data: any) => {
      const event: FineEvent = {
        type: data.type === 'bribe' ? 'bribe' : 'fine',
        amount: data.amount,
        reason: data.reason || data.message,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        fineLog: [event, ...(prev.fineLog || [])].slice(0, 20)
      }));

      if (data.type === 'avoided') {
        addNotification('Police', `Fine avoided: ${data.reason}`, 'info');
      } else {
        addNotification('Police', `Fine: $${data.amount} - ${data.reason}`, 'alert');
      }
    });

    socket.on('loan_approved', (data: Loan) => {
      setState(prev => ({
        ...prev,
        playerLoans: [data, ...(prev.playerLoans || [])]
      }));
      addNotification('Bank', `Loan of $${data.principal} approved!`, 'success');
    });

    socket.on('loan_repaid', (data: { loanId: string; amount: number; remaining: number; repaid: boolean }) => {
      setState(prev => ({
        ...prev,
        playerLoans: (prev.playerLoans || []).map(loan =>
          loan.id === data.loanId
            ? { ...loan, outstanding: data.remaining, repaid: data.repaid }
            : loan
        )
      }));
      addNotification('Bank', `Repaid $${data.amount} towards loan.`, 'success');
    });

    socket.on('loan_overdue', (data: any) => {
      addNotification('Bank', `LOAN OVERDUE: $${Math.round(data.outstanding)} is due!`, 'alert');
    });

    socket.on('tile_claimed', (data: { x: number; y: number; ownerId: string; type: string }) => {
      setState(prev => {
        const newGrid = [...prev.grid];
        newGrid[data.y] = [...prev.grid[data.y]];
        newGrid[data.y][data.x] = {
          ...newGrid[data.y][data.x],
          building: {
            ...newGrid[data.y][data.x].building,
            ownerId: data.ownerId
          }
        };
        return { ...prev, grid: newGrid };
      });
      addNotification('Land', `Property at ${data.x},${data.y} claimed.`, 'info');
    });

    socket.on('leaderboard_update', (leaderboard: LeaderboardEntry[]) => {
      const updatedLeaderboard = leaderboard.map(entry => ({
        ...entry,
        isCurrentUser: entry.walletAddress === walletAddress
      }));
      setState(prev => ({ ...prev, leaderboard: updatedLeaderboard }));
    });

    socket.on('error', (err: { message: string }) => {
      addNotification('Error', err.message, 'alert');
    });

    return () => {
      socket.off('tile_updated');
      socket.off('tile_for_sale');
      socket.off('tile_sold');
      socket.off('transaction_complete');
      socket.off('balance_update');
      socket.off('rent_collected');
      socket.off('robbery_event');
      socket.off('fine_event');
      socket.off('loan_approved');
      socket.off('loan_repaid');
      socket.off('loan_overdue');
      socket.off('tile_claimed');
      socket.off('leaderboard_update');
      socket.off('activity');
      socket.off('error');
    };
  }, [socket, walletAddress]);

  // Periodic rent collection check (every 10 seconds)
  useEffect(() => {
    if (!socket || !walletAddress || !state.grid) return;

    const rentInterval = setInterval(() => {
      // Find owned properties that might be eligible for rent
      // This is a naive check; the server enforces the real cooldown
      // We just try to collect from a few random owned tiles to avoid spamming the server all at once

      const ownedTiles: { x: number, y: number }[] = [];
      state.grid.forEach(row => {
        row.forEach(tile => {
          if (tile.building.ownerId === walletAddress &&
            tile.building.type !== 'road' &&
            tile.building.type !== 'grass' &&
            tile.building.type !== 'water') {
            ownedTiles.push({ x: tile.x, y: tile.y });
          }
        });
      });

      if (ownedTiles.length === 0) return;

      // Try to collect from up to 3 properties per cycle
      const tilesToCollect = ownedTiles.sort(() => 0.5 - Math.random()).slice(0, 3);

      tilesToCollect.forEach(tile => {
        socket.emit('collect_rent', {
          worldId: 'default-world',
          x: tile.x,
          y: tile.y,
          ownerAddress: walletAddress
        });
      });

    }, 10000); // Check every 10 seconds

    return () => clearInterval(rentInterval);
  }, [socket, walletAddress, state.grid]);

  const placeAtTile = useCallback((x: number, y: number) => {
    setState((prev) => {
      const tool = prev.selectedTool;
      if (tool === 'select') return prev;

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;

      // Multiplayer Logic: If connected and placing a building, emit event
      if (isSocketConnected && walletAddress && cost > 0) {
        // We optimistically update OR wait for server?
        // For a snappy feel, we should optimistically update but maybe show a "pending" state
        // For this MVP, let's emit and wait for the echo back (or just emit and assume success for local, but revert if error)

        // Actually, let's emit the event and let the server handle the transaction
        // But we also want to run the local simulation logic to update the grid immediately

        socket?.emit('place_building', {
          worldId: 'default-world',
          x,
          y,
          type: toolBuildingMap[tool] || 'grass', // Map tool to building type
          ownerAddress: walletAddress,
          cost
        });
      }

      // ... existing local logic ...
      if (cost > 0 && prev.stats.money < cost) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;

      // Handle subway tool separately (underground placement)
      if (tool === 'subway') {
        // Can't place subway under water
        if (tile.building.type === 'water') return prev;
        // Already has subway
        if (tile.hasSubway) return prev;

        const nextState = placeSubway(prev, x, y);
        if (nextState === prev) return prev;

        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      // Handle water terraform tool separately
      if (tool === 'zone_water') {
        // Already water - do nothing
        if (tile.building.type === 'water') return prev;
        // Don't allow terraforming bridges - would break them
        if (tile.building.type === 'bridge') return prev;

        const nextState = placeWaterTerraform(prev, x, y);
        if (nextState === prev) return prev;

        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      // Handle land terraform tool separately
      if (tool === 'zone_land') {
        // Only works on water
        if (tile.building.type !== 'water') return prev;

        const nextState = placeLandTerraform(prev, x, y);
        if (nextState === prev) return prev;

        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      let nextState: GameState;

      if (tool === 'bulldoze') {
        nextState = bulldozeTile(prev, x, y);
      } else if (zone) {
        nextState = placeBuilding(prev, x, y, null, zone);
      } else if (building) {
        nextState = placeBuilding(prev, x, y, building, null);
      } else {
        return prev;
      }

      if (nextState === prev) return prev;

      if (cost > 0) {
        nextState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
          floatingTexts: [
            ...(nextState.floatingTexts || []),
            {
              id: Math.random().toString(36).substring(7),
              x,
              y,
              text: `-$${cost}`,
              color: '#ef4444',
              opacity: 1,
              life: 1
            }
          ]
        };
      }

      return nextState;
    });
  }, [isSocketConnected, walletAddress, socket]);

  // Called after a road/rail drag operation to create bridges for water crossings
  const finishTrackDrag = useCallback((pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail') => {
    setState((prev) => createBridgesOnPath(prev, pathTiles, trackType));
  }, []);

  const connectToCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.connected) return prev;

      // Mark city as connected (and discovered if not already) and add trade income
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, connected: true, discovered: true } : c
      );

      // Add trade income bonus (one-time bonus + monthly income)
      const tradeBonus = 5000;
      const tradeIncome = 200; // Monthly income from trade

      return {
        ...prev,
        adjacentCities: updatedCities,
        stats: {
          ...prev.stats,
          money: prev.stats.money + tradeBonus,
          income: prev.stats.income + tradeIncome,
        },
        notifications: [
          {
            id: `city-connect-${Date.now()}`,
            title: 'City Connected!',
            description: `Trade route established with ${city.name}. +$${tradeBonus} bonus and +$${tradeIncome}/month income.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  const discoverCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.discovered) return prev;

      // Mark city as discovered
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, discovered: true } : c
      );

      return {
        ...prev,
        adjacentCities: updatedCities,
        notifications: [
          {
            id: `city-discover-${Date.now()}`,
            title: 'City Discovered!',
            description: `Your road has reached the ${city.direction} border! You can now connect to ${city.name}.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  // Check for cities that should be discovered based on roads reaching edges
  // Calls onDiscover callback with city info if a new city was discovered
  const checkAndDiscoverCities = useCallback((onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void): void => {
    setState((prev) => {
      const newlyDiscovered = checkForDiscoverableCities(prev.grid, prev.gridSize, prev.adjacentCities);

      if (newlyDiscovered.length === 0) return prev;

      // Discover the first city found
      const cityToDiscover = newlyDiscovered[0];

      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityToDiscover.id ? { ...c, discovered: true } : c
      );

      // Call the callback after state update is scheduled
      if (onDiscover) {
        setTimeout(() => {
          onDiscover({
            id: cityToDiscover.id,
            direction: cityToDiscover.direction,
            name: cityToDiscover.name,
          });
        }, 0);
      }

      return {
        ...prev,
        adjacentCities: updatedCities,
      };
    });
  }, []);

  const setDisastersEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, disastersEnabled: enabled }));
  }, []);

  const setSpritePack = useCallback((packId: string) => {
    const pack = getSpritePack(packId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    saveSpritePackId(packId);
  }, []);

  const setDayNightMode = useCallback((mode: DayNightMode) => {
    setDayNightModeState(mode);
    saveDayNightMode(mode);
  }, []);

  // Compute the visual hour based on the day/night mode override
  // This doesn't affect time progression, just the rendering
  const visualHour = dayNightMode === 'auto'
    ? state.hour
    : dayNightMode === 'day'
      ? 12  // Noon - full daylight
      : 22; // Night time

  const newGame = useCallback((name?: string, size?: number) => {
    clearGameState(); // Clear saved state when starting fresh
    const fresh = createInitialGameState(size ?? DEFAULT_GRID_SIZE, name || 'IsoCity');
    // Increment gameVersion from current state to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...fresh,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      // Validate it has essential properties
      if (parsed &&
        parsed.grid &&
        Array.isArray(parsed.grid) &&
        parsed.gridSize &&
        typeof parsed.gridSize === 'number' &&
        parsed.stats &&
        parsed.stats.money !== undefined &&
        parsed.stats.population !== undefined) {
        // Ensure new fields exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9;
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Increment gameVersion to clear vehicles/entities when loading a new state
        setState((prev) => ({
          ...(parsed as GameState),
          gameVersion: (prev.gameVersion ?? 0) + 1,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const exportState = useCallback((): string => {
    return JSON.stringify(state);
  }, [state]);

  const generateRandomCity = useCallback(() => {
    clearGameState(); // Clear saved state when generating a new city
    const randomCity = generateRandomAdvancedCity(DEFAULT_GRID_SIZE);
    // Increment gameVersion to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...randomCity,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  const addMoney = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + amount,
      },
    }));
  }, []);

  const addNotification = useCallback((title: string, description: string, icon: string) => {
    setState((prev) => {
      const newNotifications = [
        {
          id: `cheat-${Date.now()}-${Math.random()}`,
          title,
          description,
          icon,
          timestamp: Date.now(),
        },
        ...prev.notifications,
      ];
      // Keep only recent notifications
      while (newNotifications.length > 10) {
        newNotifications.pop();
      }
      return {
        ...prev,
        notifications: newNotifications,
      };
    });
  }, []);

  // Save current city for restore (when viewing shared cities)
  const saveCurrentCityForRestore = useCallback(() => {
    saveCityForRestore(state);
  }, [state]);

  // Restore saved city
  const restoreSavedCity = useCallback((): boolean => {
    const savedState = loadSavedCityState();
    if (savedState) {
      skipNextSaveRef.current = true;
      setState(savedState);
      clearSavedCityStorage();
      return true;
    }
    return false;
  }, []);

  // Get saved city info
  const getSavedCityInfo = useCallback((): SavedCityInfo => {
    return loadSavedCityInfo();
  }, []);

  // Clear saved city
  const clearSavedCity = useCallback(() => {
    clearSavedCityStorage();
  }, []);

  // Save current city to the multi-save system
  const saveCity = useCallback(() => {
    const cityMeta: SavedCityMeta = {
      id: state.id,
      cityName: state.cityName,
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };

    // Save the city state
    saveCityState(state.id, state);

    // Update the index
    setSavedCities((prev) => {
      // Check if this city already exists in the list
      const existingIndex = prev.findIndex((c) => c.id === state.id);
      let newCities: SavedCityMeta[];

      if (existingIndex >= 0) {
        // Update existing entry
        newCities = [...prev];
        newCities[existingIndex] = cityMeta;
      } else {
        // Add new entry
        newCities = [...prev, cityMeta];
      }

      // Sort by savedAt descending (most recent first)
      newCities.sort((a, b) => b.savedAt - a.savedAt);

      // Persist to localStorage
      saveSavedCitiesIndex(newCities);

      return newCities;
    });
  }, [state]);

  // Load a saved city from the multi-save system
  const loadSavedCity = useCallback((cityId: string): boolean => {
    const cityState = loadCityState(cityId);
    if (!cityState) return false;

    // Ensure the loaded state has an ID
    if (!cityState.id) {
      cityState.id = cityId;
    }

    // Perform migrations for backward compatibility
    if (!cityState.adjacentCities) {
      cityState.adjacentCities = [];
    }
    for (const city of cityState.adjacentCities) {
      if (city.discovered === undefined) {
        city.discovered = true;
      }
    }
    if (!cityState.waterBodies) {
      cityState.waterBodies = [];
    }
    // Ensure cities exists for multi-city support
    if (!cityState.cities) {
      cityState.cities = [{
        id: cityState.id || 'default-city',
        name: cityState.cityName || 'City',
        bounds: {
          minX: 0,
          minY: 0,
          maxX: (cityState.gridSize || 50) - 1,
          maxY: (cityState.gridSize || 50) - 1,
        },
        economy: {
          population: cityState.stats?.population || 0,
          jobs: cityState.stats?.jobs || 0,
          income: cityState.stats?.income || 0,
          expenses: cityState.stats?.expenses || 0,
          happiness: cityState.stats?.happiness || 50,
          lastCalculated: 0,
        },
        color: '#3b82f6',
      }];
    }
    if (cityState.effectiveTaxRate === undefined) {
      cityState.effectiveTaxRate = cityState.taxRate ?? 9;
    }
    if (cityState.grid) {
      for (let y = 0; y < cityState.grid.length; y++) {
        for (let x = 0; x < cityState.grid[y].length; x++) {
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.constructionProgress === undefined) {
            cityState.grid[y][x].building.constructionProgress = 100;
          }
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.abandoned === undefined) {
            cityState.grid[y][x].building.abandoned = false;
          }
        }
      }
    }

    skipNextSaveRef.current = true;
    setState((prev) => ({
      ...cityState,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));

    // Also update the current game in local storage
    saveGameState(cityState);

    return true;
  }, []);

  // Delete a saved city from the multi-save system
  const deleteSavedCity = useCallback((cityId: string) => {
    // Delete the city state
    deleteCityState(cityId);

    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.filter((c) => c.id !== cityId);
      saveSavedCitiesIndex(newCities);
      return newCities;
    });
  }, []);

  // Rename a saved city
  const renameSavedCity = useCallback((cityId: string, newName: string) => {
    // Load the city state, update the name, and save it back
    const cityState = loadCityState(cityId);
    if (cityState) {
      cityState.cityName = newName;
      saveCityState(cityId, cityState);
    }

    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.map((c) =>
        c.id === cityId ? { ...c, cityName: newName } : c
      );
      saveSavedCitiesIndex(newCities);
      return newCities;
    });

    // If the current game is the one being renamed, update its state too
    if (state.id === cityId) {
      setState((prev) => ({ ...prev, cityName: newName }));
    }
  }, [state.id]);

  const value: GameContextValue = {
    state,
    setTool,
    setSpeed,
    setTaxRate,
    setActivePanel,
    setBudgetFunding,
    placeAtTile,
    finishTrackDrag,
    connectToCity,
    discoverCity,
    checkAndDiscoverCities,
    setDisastersEnabled,
    newGame,
    loadState,
    exportState,
    generateRandomCity,
    hasExistingGame,
    isSaving,
    addMoney,
    addNotification,
    // Sprite pack management
    currentSpritePack,
    availableSpritePacks: SPRITE_PACKS,
    setSpritePack,
    // Day/night mode override
    dayNightMode,
    setDayNightMode,
    visualHour,
    // Save/restore city for shared links
    saveCurrentCityForRestore,
    restoreSavedCity,
    getSavedCityInfo,
    clearSavedCity,
    // Multi-city save system
    savedCities,
    saveCity,
    loadSavedCity,
    deleteSavedCity,
    renameSavedCity,
    addFloatingText,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
