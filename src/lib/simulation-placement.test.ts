import { describe, it, expect, beforeEach } from 'vitest';
import { 
  placeBuilding,
  createInitialGameState,
} from './simulation';
import { GameState, BuildingType } from '@/types/game';

describe('placeBuilding - Road Connectivity Validation', () => {
  let state: GameState;
  const gridSize = 30;

  beforeEach(() => {
    state = createInitialGameState(gridSize, 'Test City');
    // Clear any water that might interfere with tests - use center area which is usually land
    // Clear a safe area in the center of the grid for testing
    const newGrid = state.grid.map(row => row.map(tile => {
      if (tile.building.type === 'water' && tile.x >= 5 && tile.x < 25 && tile.y >= 5 && tile.y < 25) {
        return { ...tile, building: { ...tile.building, type: 'grass' } };
      }
      return tile;
    }));
    state = { ...state, grid: newGrid };
  });

  describe('Power Plant Placement', () => {
    it('should allow placement when adjacent to road', () => {
      // Place a road first (at 10,10)
      const roadState = placeBuilding(state, 10, 10, 'road', null);
      
      // Try to place power plant adjacent to road (north at 9,10)
      // Power plant is 2x2, so it will occupy (9,10), (10,10), (9,11), (10,11)
      // But (10,10) has a road, so we need to place the building elsewhere
      // Place power plant at (12,10) with road at (11,10) adjacent
      const roadState2 = placeBuilding(roadState, 11, 10, 'road', null);
      const result = placeBuilding(roadState2, 12, 10, 'power_plant', null);
      
      // Should succeed - building should be placed
      expect(result.grid[12][10].building.type).toBe('power_plant');
    });

    it('should allow placement when 1 tile away from road', () => {
      // Place road at (10,10)
      const roadState = placeBuilding(state, 10, 10, 'road', null);
      
      // Power plant 1 tile away diagonally (at 9,9) - road at (10,10) is 1 tile away
      const result = placeBuilding(roadState, 9, 9, 'power_plant', null);
      
      expect(result.grid[9][9].building.type).toBe('power_plant');
    });

    it('should block placement when 2+ tiles away from road', () => {
      const roadState = placeBuilding(state, 10, 10, 'road', null);
      
      // Power plant 2 tiles away
      const result = placeBuilding(roadState, 8, 10, 'power_plant', null);
      
      // Should fail - state should be unchanged
      expect(result).toBe(roadState);
      expect(result.grid[8][10].building.type).not.toBe('power_plant');
    });

    it('should block placement when no road nearby', () => {
      // No roads placed
      const result = placeBuilding(state, 10, 10, 'power_plant', null);
      
      // Should fail - state should be unchanged
      expect(result).toBe(state);
      expect(result.grid[10][10].building.type).not.toBe('power_plant');
    });
  });

  describe('Other Service Building Placement', () => {
    const serviceBuildings: BuildingType[] = [
      'water_tower',
      'police_station',
      'fire_station',
      'hospital',
      'school',
    ];

    serviceBuildings.forEach((buildingType) => {
      describe(`${buildingType}`, () => {
        it('should allow placement when adjacent to road', () => {
          // Place road at (10,10)
          const roadState = placeBuilding(state, 10, 10, 'road', null);
          
          // Verify road was placed
          expect(roadState.grid[10][10].building.type).toBe('road');
          
          // Place building adjacent (north at 9,10)
          const result = placeBuilding(roadState, 9, 10, buildingType, null);
          
          expect(result.grid[9][10].building.type).toBe(buildingType);
        });

        it('should block placement when 1 tile away from road', () => {
          const roadState = placeBuilding(state, 10, 10, 'road', null);
          
          // Place 1 tile away (2 tiles north)
          const result = placeBuilding(roadState, 8, 10, buildingType, null);
          
          // Should fail
          expect(result).toBe(roadState);
          expect(result.grid[8][10].building.type).not.toBe(buildingType);
        });

        it('should block placement when no road nearby', () => {
          const result = placeBuilding(state, 10, 10, buildingType, null);
          
          // Should fail
          expect(result).toBe(state);
          expect(result.grid[10][10].building.type).not.toBe(buildingType);
        });
      });
    });
  });

  describe('Multi-tile Service Building Placement', () => {
    it('should allow hospital (2x2) when any tile is adjacent to road', () => {
      // Hospital at (12,12) occupies (12,12), (13,12), (12,13), (13,13)
      // Place road adjacent to northwest corner (north of 12,12 at 11,12)
      const roadState = placeBuilding(state, 11, 12, 'road', null);
      
      // Hospital should be placeable
      const result = placeBuilding(roadState, 12, 12, 'hospital', null);
      
      expect(result.grid[12][12].building.type).toBe('hospital');
    });

    it('should block hospital (2x2) when no tile is adjacent to road', () => {
      const roadState = placeBuilding(state, 5, 5, 'road', null);
      
      // Hospital far from road
      const result = placeBuilding(roadState, 20, 20, 'hospital', null);
      
      // Should fail
      expect(result).toBe(roadState);
      expect(result.grid[20][20].building.type).not.toBe('hospital');
    });
  });

  describe('Non-Service Building Placement', () => {
    it('should allow non-service buildings without road requirement', () => {
      // No roads needed for residential/commercial/industrial
      const result = placeBuilding(state, 10, 10, 'house_small', null);
      
      expect(result.grid[10][10].building.type).toBe('house_small');
    });
  });

  describe('Edge Cases', () => {
    it('should handle placement at map edges', () => {
      // Place road at edge
      const roadState = placeBuilding(state, 0, 10, 'road', null);
      
      // Power plant adjacent (can't go north, so place south)
      const result = placeBuilding(roadState, 1, 10, 'power_plant', null);
      
      expect(result.grid[1][10].building.type).toBe('power_plant');
    });

    it('should not interfere with existing building placement logic', () => {
      // Can't build on water
      const waterState = placeBuilding(state, 10, 10, 'water', null);
      const result = placeBuilding(waterState, 10, 10, 'hospital', null);
      
      expect(result).toBe(waterState);
      expect(result.grid[10][10].building.type).toBe('water');
    });
  });
});

