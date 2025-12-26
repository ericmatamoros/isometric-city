import { describe, it, expect, beforeEach } from 'vitest';
import { 
  isServiceBuildingRoadConnected,
  getBuildingSize 
} from './simulation';
import { Tile, Building, BuildingType } from '@/types/game';

// Helper function to create a grid with roads and buildings
function createTestGrid(size: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = {
        x,
        y,
        zone: 'none',
        building: {
          type: 'grass',
          level: 0,
          population: 0,
          jobs: 0,
          powered: false,
          watered: false,
          onFire: false,
          fireProgress: 0,
          age: 0,
          constructionProgress: 100,
          abandoned: false,
        },
        landValue: 0,
        pollution: 0,
        crime: 0,
        traffic: 0,
        hasSubway: false,
      };
    }
  }
  return grid;
}

function placeRoad(grid: Tile[][], x: number, y: number): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x].building.type = 'road';
  }
}

function placeBuilding(grid: Tile[][], x: number, y: number, buildingType: BuildingType): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x].building.type = buildingType;
  }
}

describe('isServiceBuildingRoadConnected', () => {
  let grid: Tile[][];
  const gridSize = 20;

  beforeEach(() => {
    grid = createTestGrid(gridSize);
  });

  describe('Power Plant (can be 1 tile away)', () => {
    it('should return true for power plant adjacent to road (north)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 9, 10); // north (x-1, y)
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant adjacent to road (south)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 11, 10); // south (x+1, y)
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant adjacent to road (east)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 10, 9); // east (x, y-1)
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant adjacent to road (west)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 10, 11); // west (x, y+1)
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant 1 tile away diagonally (northwest)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 9, 11); // northwest diagonal
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant 1 tile away diagonally (northeast)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 9, 9); // northeast diagonal
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant 1 tile away diagonally (southwest)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 11, 11); // southwest diagonal
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for power plant 1 tile away diagonally (southeast)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 11, 9); // southeast diagonal
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return false for power plant 2 tiles away from road', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 8, 10); // 2 tiles north
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(false);
    });

    it('should return false for power plant with no nearby roads', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 5, 5); // Road far away
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(false);
    });
  });

  describe('Other Service Buildings (must be directly adjacent)', () => {
    const otherServiceBuildings: BuildingType[] = [
      'water_tower',
      'police_station',
      'fire_station',
      'hospital',
      'school',
      'university',
    ];

    otherServiceBuildings.forEach((buildingType) => {
      describe(`${buildingType}`, () => {
        it('should return true when adjacent to road (north)', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 9, 10); // north
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(true);
        });

        it('should return true when adjacent to road (south)', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 11, 10); // south
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(true);
        });

        it('should return true when adjacent to road (east)', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 10, 9); // east
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(true);
        });

        it('should return true when adjacent to road (west)', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 10, 11); // west
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(true);
        });

        it('should return false when 1 tile away diagonally', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 9, 9); // northeast diagonal (1 tile away)
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(false);
        });

        it('should return false when 1 tile away in cardinal direction', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 8, 10); // 2 tiles north (1 tile gap)
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(false);
        });

        it('should return false with no nearby roads', () => {
          placeBuilding(grid, 10, 10, buildingType);
          placeRoad(grid, 5, 5); // Road far away
          expect(isServiceBuildingRoadConnected(grid, 10, 10, buildingType, gridSize)).toBe(false);
        });
      });
    });
  });

  describe('Multi-tile Buildings', () => {
    it('should return true for hospital (2x2) where one tile is adjacent to road', () => {
      // Hospital is 2x2, place it at (10, 10) so it occupies (10,10), (11,10), (10,11), (11,11)
      placeBuilding(grid, 10, 10, 'hospital');
      // Place road adjacent to the northwest corner (north of tile at 10,10)
      placeRoad(grid, 9, 10);
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'hospital', gridSize)).toBe(true);
    });

    it('should return true for hospital (2x2) where road is adjacent to different corner', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      // Place road adjacent to the southeast corner (south of tile at 11,11)
      placeRoad(grid, 12, 11);
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'hospital', gridSize)).toBe(true);
    });

    it('should return false for hospital (2x2) with no adjacent roads', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 5, 5); // Road far away
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'hospital', gridSize)).toBe(false);
    });

    it('should return true for power plant (2x2) where road is 1 tile away from any corner', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      // Place road 1 tile away diagonally from northwest corner (10,10)
      // Road at (9, 9) is 1 tile away diagonally from (10, 10)
      placeRoad(grid, 9, 9);
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'power_plant', gridSize)).toBe(true);
    });

    it('should return true for university (3x3) where one tile is adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'university');
      // Place road adjacent to the center tile
      placeRoad(grid, 11, 10); // south of center tile
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'university', gridSize)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should return true for non-service buildings (no requirement)', () => {
      placeBuilding(grid, 10, 10, 'house_small');
      // No roads needed
      expect(isServiceBuildingRoadConnected(grid, 10, 10, 'house_small', gridSize)).toBe(true);
    });

    it('should handle buildings at map edge (north)', () => {
      placeBuilding(grid, 0, 10, 'hospital');
      placeRoad(grid, 0, 9); // east (valid)
      expect(isServiceBuildingRoadConnected(grid, 0, 10, 'hospital', gridSize)).toBe(true);
    });

    it('should handle buildings at map edge (south)', () => {
      placeBuilding(grid, gridSize - 1, 10, 'hospital');
      placeRoad(grid, gridSize - 2, 10); // north (valid)
      expect(isServiceBuildingRoadConnected(grid, gridSize - 1, 10, 'hospital', gridSize)).toBe(true);
    });

    it('should handle buildings at map edge (east)', () => {
      placeBuilding(grid, 10, 0, 'hospital');
      placeRoad(grid, 10, 1); // west (valid)
      expect(isServiceBuildingRoadConnected(grid, 10, 0, 'hospital', gridSize)).toBe(true);
    });

    it('should handle buildings at map edge (west)', () => {
      placeBuilding(grid, 10, gridSize - 1, 'hospital');
      placeRoad(grid, 10, gridSize - 2); // east (valid)
      expect(isServiceBuildingRoadConnected(grid, 10, gridSize - 1, 'hospital', gridSize)).toBe(true);
    });

    it('should not check out-of-bounds tiles', () => {
      placeBuilding(grid, 0, 0, 'hospital');
      // No roads, but should not crash when checking north/west neighbors
      expect(isServiceBuildingRoadConnected(grid, 0, 0, 'hospital', gridSize)).toBe(false);
    });
  });
});

