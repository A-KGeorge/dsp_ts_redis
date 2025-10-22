/**
 * Options for processing audio data
 */
export interface ProcessOptions {
  sampleRate: number;
  channels?: number;
}

/**
 * Redis configuration for state persistence
 */
export interface RedisConfig {
  redisHost?: string;
  redisPort?: number;
  stateKey?: string;
}

/**
 * Parameters for adding a moving average stage
 */
export interface MovingAverageParams {
  windowSize: number;
}
