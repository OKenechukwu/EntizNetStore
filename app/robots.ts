import type { MetadataRoute } from 'next'
import { publicRobotsRules } from '@/lib/launch/publicIndexing'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: publicRobotsRules(),
  }
}
