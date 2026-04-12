import config from '../../config'
import { cn } from '../../utils/tw'
import type { Film } from '../../vf'
import { Button } from '../ui/button'

export const StdLinks = ({
  film,
  buttonClassName = '',
}: {
  film: {
    title: Film['title']
    tmdbId: Film['tmdbId']
  }
  buttonClassName?: string
}) => {
  return (
    <Button
      asChild
      variant='outline'
      className={cn(
        'rounded-lg border-foreground md:backdrop-blur-lg',
        buttonClassName,
      )}
    >
      <a
        href={`${config.anilistAnimeBaseUrl}${film.tmdbId}`}
        target='_blank'
        rel='noreferrer'
      >
        AniList
      </a>
    </Button>
  )
}
