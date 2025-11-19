# codymatch 0.1

## Commands

Create and start containers:

```
> ./codymatch.sh up
```

Stop running containers:

```
> ./codymatch.sh stop
```

Stop and remove containers & networks:

```
> ./codymatch.sh down
```

Stop and remove containers & networks + build or rebuild services:

```
> ./codymatch.sh build
```

View output from containers:

```
> ./codymatch.sh logs
```

Stop, remove, build, create, start containers & networks and view output:

```
> ./codymatch.sh bul
```

Create, start containers & networks and view output:

```
> ./codymatch.sh ul
```

Stop, remove, create, start containers & networks and view output:

```
> ./codymatch.sh dul
```

Start local testing environment:

```
> ./codymatch.sh test
```

Pull latest version from git and deploy

```
> ./codymatch.sh deploy
```

### Backend container only

Restart backend service container:

```
> ./codymatch.sh backend restart
```

View output from backend container:

```
> ./codymatch.sh backend logs
```

Restart backend service container and view output:

```
> ./codymatch.sh brl
```

Execute /bin/sh command in backend container:

```
> ./codymatch.sh backend bash
```

Execute npm command in backend container:

```
> ./codymatch.sh backend npm
```

Execute npx command in backend container:

```
> ./codymatch.sh backend npx
```

### Frontend container only

Restart frontend service container:

```
> ./codymatch.sh frontend restart
```

View output from frontend container:

```
> ./codymatch.sh frontend logs
```

Execute /bin/sh command in frontend container:

```
> ./codymatch.sh frontend bash
```

Execute npm command in frontend container:

```
> ./codymatch.sh frontend npm
```
