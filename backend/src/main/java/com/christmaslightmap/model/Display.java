package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "displays")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Display {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;

    @Column(columnDefinition = "geography(Point, 4326)", nullable = false)
    private Point location;

    @Column(name = "best_time")
    private String bestTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "display_type", nullable = false)
    @Builder.Default
    private DisplayType displayType = DisplayType.DRIVE_BY;

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
