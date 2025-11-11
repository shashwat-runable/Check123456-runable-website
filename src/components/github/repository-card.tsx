import { Link } from "react-router-dom";
import { Star, GitFork, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RepositoryCardProps {
  id: string;
  name: string;
  description?: string | null;
  language?: string | null;
  starsCount: number;
  forksCount: number;
  updatedAt: Date;
  owner: {
    id: string;
    name: string;
    image?: string | null;
  };
}

export function RepositoryCard({
  id,
  name,
  description,
  language,
  starsCount,
  forksCount,
  updatedAt,
  owner,
}: RepositoryCardProps) {
  const timeAgo = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.ceil((new Date(updatedAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  );

  return (
    <Card className="hover:border-primary transition">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">
              <Link
                to={`/repository/${id}`}
                className="hover:text-primary transition truncate"
              >
                {name}
              </Link>
            </CardTitle>
            {description && (
              <CardDescription className="mt-2 line-clamp-2">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/profile/${owner.id}`}
              className="flex items-center gap-2 text-sm hover:text-primary transition"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={owner.image || undefined} alt={owner.name} />
                <AvatarFallback className="text-xs">
                  {owner.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">{owner.name}</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          {language && (
            <Badge variant="secondary" className="font-normal">
              {language}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            <span>{starsCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitFork className="h-4 w-4" />
            <span>{forksCount}</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Clock className="h-4 w-4" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
