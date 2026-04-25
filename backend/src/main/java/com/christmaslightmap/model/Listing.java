package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "listings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id")
    private Host host;

    @Column(nullable = false)
    private String title;

    private String description;
    @Column(name = "address", length = 500)
    private String address;
    private String city;
    private String state;
    private String postcode;

    @Column(columnDefinition = "geography(Point, 4326)", nullable = false)
    private Point location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    @Column(name = "start_datetime", nullable = false)
    private LocalDateTime startDatetime;

    @Column(name = "end_datetime", nullable = false)
    private LocalDateTime endDatetime;

    // Christmas Lights only
    @Column(name = "best_time")
    private String bestTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "display_type")
    private DisplayType displayType;

    // Food Truck only
    @Column(name = "cuisine_type", length = 100)
    private String cuisineType;

    // Estate Sale only
    @Column(name = "organizer")
    private String organizer;

    @Column(name = "host_name", length = 100)
    private String hostName;

    // Christmas Lights + Food Truck only
    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    // Optional for all categories
    @Column(name = "price_info")
    private String priceInfo;

    @Column(name = "upvote_count", nullable = false)
    private int upvoteCount;

    @Column(name = "photo_count", nullable = false)
    private int photoCount;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "display_tags",
        joinColumns = @JoinColumn(name = "display_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();
}
