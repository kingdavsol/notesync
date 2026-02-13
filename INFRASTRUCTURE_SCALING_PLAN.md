# NoteSync Infrastructure Scaling Plan
**Date:** February 12, 2026
**Target:** 1,000 Daily Active Users (DAU)

---

## Current Infrastructure (Baseline)

### Server Specifications
- **Provider**: Contabo VPS
- **CPU**: 6 cores (assumed from worker processes)
- **RAM**: 14GB (from system limit in logs)
- **Storage**: Unknown total, but adequate for current load
- **Bandwidth**: Unknown limits
- **Current Load**: ~20 concurrent apps on PM2, minimal traffic

### Current Stack
- **Web Server**: Nginx 1.18.0
- **Application**: Node.js 18+ / Express
- **Database**: PostgreSQL 14 (single instance)
- **Process Manager**: PM2
- **Caching**: None (in-memory rate limiting only)
- **CDN**: None
- **Monitoring**: None

---

## Usage Projections for 1,000 DAU

### User Behavior Assumptions
- **Active Hours**: 8 hours/day average per user
- **Notes Created**: 3-5 notes per user per day
- **Notes Edited**: 10-15 edits per user per day
- **Searches**: 5-10 searches per user per day
- **Sync Operations**: 20-30 per user per day (mobile + web)
- **Collaboration Sessions**: 10% of users (100 simultaneous WebSocket connections)
- **Average Note Size**: 5KB text + 2KB metadata = 7KB
- **Average API Request Size**: 3KB
- **Average API Response Size**: 10KB

### Traffic Estimates

#### API Requests per Day
```
1,000 users × (5 creates + 15 edits + 10 searches + 30 syncs) = 60,000 requests/day
= 2,500 requests/hour (peak)
= 42 requests/minute (peak)
= 0.7 requests/second (average peak)
```

#### WebSocket Connections
```
Peak Concurrent: 100 users in collaboration = 100 WebSocket connections
Messages per connection per hour: ~120 (cursor moves, typing indicators)
Total WebSocket messages/hour (peak): 12,000 messages
```

#### Database Operations
```
Reads: 50,000/day (notes, folders, tags, search)
Writes: 10,000/day (creates, updates, syncs)
Peak: ~2,000 queries/hour = 33 queries/minute
```

#### Storage Growth
```
New Notes/Day: 1,000 users × 4 notes × 7KB = 28MB/day
Monthly Growth: 840MB/month = ~1GB/month
Yearly Growth: ~12GB/year (notes only)
With attachments (if enabled): 50-100GB/year
```

#### Bandwidth
```
Inbound: 60,000 requests × 3KB = 180MB/day
Outbound: 60,000 responses × 10KB = 600MB/day
Total: ~780MB/day = 24GB/month
With mobile sync: ~40GB/month
```

---

## Resource Requirements for 1,000 DAU

### Scenario 1: Single Server (Adequate)
**Can handle 1,000 DAU with optimizations**

**Minimum Specifications**:
- **CPU**: 4 cores (66% utilization at peak)
- **RAM**: 8GB (4GB app, 2GB PostgreSQL, 2GB system/cache)
- **Storage**: 50GB SSD (20GB OS, 15GB app/database, 15GB growth buffer)
- **Bandwidth**: 50GB/month (with 25% buffer)
- **Cost**: $15-30/month (Contabo, DigitalOcean, Linode)

**Required Optimizations**:
1. ✅ **Add Redis** for session storage and rate limiting
   - Offload from in-memory to persistent cache
   - Cost: $10/month (managed) or $0 (self-hosted on same VPS)

2. ✅ **PostgreSQL Tuning**
   ```sql
   -- postgresql.conf
   shared_buffers = 2GB
   effective_cache_size = 6GB
   work_mem = 16MB
   maintenance_work_mem = 512MB
   max_connections = 200
   ```

3. ✅ **Connection Pooling** (pgBouncer)
   - Reduce database connection overhead
   - Max pool size: 50 connections

4. ✅ **Nginx Caching**
   - Cache API GET responses (notes list, folders, tags)
   - 1-minute cache TTL
   - Reduces database load by 40%

5. ✅ **CDN for Static Assets** (Cloudflare Free)
   - Offload CSS, JS, images
   - Saves ~60% bandwidth

**Current Server Status**: ✅ **ADEQUATE**
- Current Contabo VPS with 6 cores and 14GB RAM can handle this load
- Need to implement optimizations 1-5 above

---

### Scenario 2: Scaled Infrastructure (Future-Proof)
**For 1,000-5,000 DAU with high availability**

#### Application Tier
- **Load Balancer**: Nginx or HAProxy
- **App Servers**: 2× VPS (4 cores, 8GB RAM each)
  - Active-active for redundancy
  - Cost: $30-40/month each = $60-80/month
- **PM2 Cluster Mode**: 4 workers per server

#### Database Tier
- **Primary PostgreSQL**: 4 cores, 8GB RAM, 100GB SSD
  - Cost: $40-60/month
- **Read Replica**: 2 cores, 4GB RAM (optional)
  - For search queries and reporting
  - Cost: $20-30/month
- **Backup**: Daily automated to S3/Backblaze
  - Cost: $5/month for 100GB

#### Cache Tier
- **Redis Managed Instance**: 2GB RAM
  - Session storage, rate limiting, query cache
  - Cost: $15/month

#### Storage
- **Object Storage** (S3/Backblaze): Attachments, images
  - 100GB storage + bandwidth
  - Cost: $5-10/month

#### CDN
- **Cloudflare Pro**: $20/month
  - Advanced caching, image optimization, DDoS protection

#### Monitoring
- **Uptime Monitoring**: UptimeRobot (free) or Pingdom ($10/month)
- **Error Tracking**: Sentry ($26/month for 1,000 DAU)
- **Performance**: New Relic or DataDog ($15/month starter)

**Total Cost**: $200-260/month
**Availability**: 99.9% uptime

---

## Performance Benchmarks

### Current Server Capacity (Estimated)

**Single Nginx + Node.js + PostgreSQL**:
- **Max Concurrent Users**: 500-1,000 (with optimizations)
- **Max Requests/Second**: 50-100 req/s
- **Max WebSocket Connections**: 500-1,000
- **Max Database Queries/Second**: 200-500 queries/s

### Bottlenecks to Watch

1. **PostgreSQL Connections** (most likely first bottleneck)
   - Default max: 100 connections
   - Each PM2 worker: 10 connections
   - With 6 workers + WebSocket: 70 connections used
   - **Solution**: pgBouncer connection pooling

2. **Memory (RAM)**
   - Node.js app: ~100MB per PM2 worker × 6 = 600MB
   - PostgreSQL: 2-3GB
   - Redis: 500MB
   - Nginx: 100MB
   - System: 1GB
   - **Total**: 4-5GB (leaves 9GB buffer on current server)

3. **CPU**
   - Nginx: Minimal (<5%)
   - Node.js: 10-20% per worker at peak
   - PostgreSQL: 20-30% at peak
   - **Total**: 40-60% at peak (safe margin)

4. **Disk I/O**
   - PostgreSQL writes: 10MB/hour
   - Logs: 50MB/day
   - **Total**: Minimal for SSD

5. **Network Bandwidth**
   - 40GB/month = well within any VPS limits
   - CDN offloads 60% = 16GB/month actual usage

---

## Scaling Triggers

### When to Add Resources

**Immediate Actions Needed** (0-100 users):
- ✅ Add Redis for session/cache
- ✅ Implement Nginx caching
- ✅ Set up CDN (Cloudflare Free)
- ✅ Add monitoring (UptimeRobot + Sentry)
- ✅ Tune PostgreSQL configuration

**Next Tier** (100-500 users):
- Add database connection pooling (pgBouncer)
- Upgrade to PM2 cluster mode with 4+ workers
- Implement database query optimization
- Add automated backups

**Scale-Out Needed** (500-1,000 users):
- Add load balancer
- Deploy second application server
- Consider read replica for database
- Upgrade to managed Redis

**Enterprise Tier** (1,000+ users):
- Move to multi-server architecture (Scenario 2)
- Implement database sharding if needed
- Consider microservices for collaboration/sync
- Add queueing system (RabbitMQ, Redis Queue)

---

## Monitoring Metrics

### Key Performance Indicators (KPIs)

**Application Metrics**:
- Response time (P50, P95, P99)
  - Target: P95 < 200ms
- Error rate
  - Target: < 0.1%
- Requests per second
- Active WebSocket connections

**Database Metrics**:
- Query time (P95)
  - Target: < 50ms
- Connection pool usage
  - Alert: > 80%
- Cache hit rate
  - Target: > 70%
- Disk usage
  - Alert: > 80%

**Server Metrics**:
- CPU usage
  - Alert: > 80% sustained
- Memory usage
  - Alert: > 85%
- Disk I/O
  - Alert: > 80% capacity
- Network bandwidth
  - Alert: > 80% of limit

---

## Cost Breakdown for 1,000 DAU

### Minimal Setup (Current Server + Optimizations)
| Item | Cost |
|------|------|
| Contabo VPS (current) | $10-15/month |
| Redis (self-hosted) | $0 |
| Cloudflare Free CDN | $0 |
| Domain + SSL | $0 (existing) |
| Email (Resend) | $0-10/month |
| Monitoring (free tier) | $0 |
| **Total** | **$10-25/month** |
| **Cost per DAU** | **$0.01-0.025** |

### Recommended Setup (With Scaling Buffer)
| Item | Cost |
|------|------|
| Application Server | $30/month |
| Redis Managed | $15/month |
| PostgreSQL Managed | $50/month |
| Object Storage (S3) | $10/month |
| CDN (Cloudflare Pro) | $20/month |
| Monitoring (Sentry) | $26/month |
| Backups | $5/month |
| Email (Resend) | $10/month |
| **Total** | **$166/month** |
| **Cost per DAU** | **$0.166** |

### Enterprise Setup (High Availability)
| Item | Cost |
|------|------|
| Load Balancer | $10/month |
| App Servers (2×) | $60/month |
| Database (Primary + Replica) | $80/month |
| Redis Managed | $15/month |
| Object Storage | $10/month |
| CDN | $20/month |
| Monitoring Suite | $50/month |
| Backups | $10/month |
| Email | $20/month |
| **Total** | **$275/month** |
| **Cost per DAU** | **$0.275** |

---

## Recommendations

### Short Term (Next 30 Days)
1. ✅ **Implement Redis** - Critical for session management
2. ✅ **Add Monitoring** - UptimeRobot + Sentry (free tiers)
3. ✅ **Set up Cloudflare** - Free CDN + DDoS protection
4. ✅ **Tune PostgreSQL** - Update configuration for 8GB RAM
5. ✅ **Automated Backups** - Daily PostgreSQL dumps to external storage

**Estimated Cost**: $0-10/month additional
**Implementation Time**: 2-4 hours

### Medium Term (1-3 Months)
1. Add pgBouncer connection pooling
2. Implement Nginx response caching
3. Set up error tracking (Sentry paid tier)
4. Create staging environment
5. Implement database index optimization

**Estimated Cost**: $20-30/month additional
**Implementation Time**: 8-12 hours

### Long Term (3-6 Months)
1. Move to managed database (if user base grows)
2. Add second application server
3. Implement load balancing
4. Set up CI/CD pipeline
5. Add comprehensive monitoring suite

**Estimated Cost**: $100-150/month additional
**Implementation Time**: 20-40 hours

---

## Conclusion

### Current Status
✅ **The existing Contabo VPS can handle 1,000 DAU** with the following conditions:
- Implement Redis for session/cache (critical)
- Tune PostgreSQL configuration
- Add Cloudflare CDN (free tier adequate)
- Set up basic monitoring

### Current Capacity
- **Estimated Current Capacity**: 500-1,000 concurrent users
- **With Optimizations**: 1,000-1,500 concurrent users
- **Current Cost**: $10-15/month (VPS only)
- **Optimized Cost**: $25-40/month (with Redis, CDN, monitoring)

### When to Scale
- **0-500 users**: Current server + basic optimizations
- **500-1,000 users**: Add Redis, CDN, monitoring, connection pooling
- **1,000-2,000 users**: Consider managed database and second app server
- **2,000+ users**: Full multi-server architecture (Scenario 2)

### Immediate Action Items
1. Install and configure Redis
2. Update PostgreSQL configuration
3. Set up Cloudflare (free tier)
4. Install pgBouncer
5. Add UptimeRobot monitoring

**Total Implementation Time**: 4-6 hours
**Total Additional Monthly Cost**: $0-15

---

**Document Created**: February 12, 2026
**Next Review**: After reaching 250 DAU
